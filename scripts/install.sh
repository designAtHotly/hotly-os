#!/usr/bin/env bash
# Hotly operator installer. One script: fail-fast gates, then .env + Compose.
# Not a binary dropper (unlike OpenCode). Does not install Docker or Bun.
set -euo pipefail

MUTED='\033[0;2m'
RED='\033[0;31m'
ORANGE='\033[38;5;214m'
NC='\033[0m'

ROOT=""
SKIP_DOWNLOAD=false
SKIP_FIREBASE=false
SKIP_STRIPE=false
SKIP_SENDGRID=false
SKIP_UP=false
SKIP_SPEC=false
ASSUME_YES=false
TAG="${HOTLY_TAG:-}"
GITHUB_REPO="${HOTLY_GITHUB:-designAtHotly/hotly-os}"
INSTALL_DIR="${HOTLY_ROOT:-}"

usage() {
  cat <<'EOF'
Hotly installer

Configures this Compose tree (or a Release tarball) and starts it.
Does not create Docker, DNS, Firebase, Stripe, or SendGrid accounts.

Usage:
  ./scripts/install.sh [options]
  curl -fsSL <release-raw-install.sh> | bash -s -- [options]

Options:
  -h, --help           This text
  --local              Use this checkout (skip GitHub download). Default when
                       docker-compose.yml sits next to this script.
  --skip-download      Same as --local
  --skip-firebase      Leave Firebase env as-is (or empty)
  --skip-stripe        Leave Stripe env as-is (or empty)
  --skip-sendgrid      Leave SendGrid env as-is (or empty)
  --skip-up            Write files only; do not run docker compose
  --skip-spec          Do not exit when Docker has fewer than 2 CPUs or 4 GB RAM
  --yes                No prompts; keep existing .env; skip empty providers
  --tag <v0.1.4>       Release tag to unpack when downloading (or HOTLY_TAG)
  --github <org/repo>  GitHub repo for the tarball (or HOTLY_GITHUB)
  --dir <path>         Where a curl install unpacks (or HOTLY_ROOT). Default ~/hotly-os.
                       .env lives at <path>/.env. Not used with --local.

Re-run to change keys. Never uses docker compose down -v.

From a checkout: ./scripts/install.sh --local
From a VPS: curl the install script and pass --tag v0.1.4 --github designAtHotly/hotly-os.
The tree lands in ~/hotly-os (prompt, or --dir / HOTLY_ROOT), not /tmp.
EOF
}

info() { echo -e "${MUTED}$*${NC}"; }
warn() { echo -e "${ORANGE}$*${NC}" >&2; }
fail() { echo -e "${RED}$*${NC}" >&2; exit 1; }

while [[ $# -gt 0 ]]; do
  case "$1" in
    -h | --help)
      usage
      exit 0
      ;;
    --local | --skip-download)
      SKIP_DOWNLOAD=true
      shift
      ;;
    --skip-firebase)
      SKIP_FIREBASE=true
      shift
      ;;
    --skip-stripe)
      SKIP_STRIPE=true
      shift
      ;;
    --skip-sendgrid)
      SKIP_SENDGRID=true
      shift
      ;;
    --skip-up)
      SKIP_UP=true
      shift
      ;;
    --skip-spec)
      SKIP_SPEC=true
      shift
      ;;
    --yes)
      ASSUME_YES=true
      shift
      ;;
    --)
      shift
      ;;
    --tag | ----tag)
      [[ -n "${2:-}" ]] || fail "--tag needs a value (e.g. v0.1.4)"
      TAG="$2"
      shift 2
      ;;
    --github)
      [[ -n "${2:-}" ]] || fail "--github needs org/repo"
      GITHUB_REPO="$2"
      shift 2
      ;;
    --dir)
      [[ -n "${2:-}" ]] || fail "--dir needs a path (e.g. /opt/hotly-os or ~/hotly-os)"
      INSTALL_DIR="$2"
      shift 2
      ;;
    *)
      warn "Unknown option: $1"
      shift
      ;;
  esac
done

script_on_disk() {
  [[ -n "${BASH_SOURCE[0]:-}" && -f "${BASH_SOURCE[0]}" ]]
}

find_root_from_script() {
  local dir
  dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
  [[ -f "$dir/docker-compose.yml" && -f "$dir/.env.example" ]]
}

educate_docker() {
  cat >&2 <<EOF

$(echo -e "${RED}Docker is required. Hotly is a Compose app, not a single binary.${NC}")

This installer will not install Docker for you (Engine is root + distro-specific;
macOS needs OrbStack or Docker Desktop, not get.docker.com). Windows is not a
supported host.

Install:
  • Linux VPS: Docker Engine + Compose v2 — https://docs.docker.com/engine/install/
  • macOS:     https://orbstack.dev/  or Docker Desktop (includes Compose v2)

You need both the daemon (\`docker info\`) and the Compose v2 plugin
(\`docker compose version\`, with a space). The old docker-compose (hyphen)
binary is not enough.
Host size if you build images on the machine: 2 vCPU / 4 GB RAM.

Then re-run this script. Docs: docs/operations.md
EOF
  exit 1
}

educate_curl_tar() {
  cat >&2 <<EOF

$(echo -e "${RED}Need curl and tar to download a Release.${NC}")

Install them from your OS, or skip the download and run from a checkout:

  ./scripts/install.sh --local

EOF
  exit 1
}

educate_no_release() {
  cat >&2 <<EOF

$(echo -e "${RED}Pass --github designAtHotly/hotly-os (or set HOTLY_GITHUB) and a Release tag.${NC}")

From a checkout of this tree:

  ./scripts/install.sh --local

From a VPS, pin the tag:

  curl -fsSL https://raw.githubusercontent.com/designAtHotly/hotly-os/v0.1.4/scripts/install.sh | bash -s -- --tag v0.1.4 --github designAtHotly/hotly-os

EOF
  exit 1
}

gate_docker() {
  if ! command -v docker >/dev/null 2>&1; then
    educate_docker
  fi
  if ! docker info >/dev/null 2>&1; then
    echo -e "${RED}docker is installed but the daemon is not reachable.${NC}" >&2
    echo "Start OrbStack / Docker Desktop / the docker service, then re-run." >&2
    exit 1
  fi
  if ! docker compose version >/dev/null 2>&1; then
    echo -e "${RED}\`docker compose\` (v2 plugin) is missing.${NC}" >&2
    echo "Install Compose v2: https://docs.docker.com/compose/install/" >&2
    echo "The old docker-compose (hyphen) binary is not enough." >&2
    exit 1
  fi
}

# Human GiB from bytes (1 decimal).
fmt_gib() {
  awk -v b="$1" 'BEGIN { printf "%.1f GiB", b / 1073741824 }'
}

host_cpus() {
  if command -v nproc >/dev/null 2>&1; then
    nproc
  elif [[ -r /proc/cpuinfo ]]; then
    grep -c '^processor' /proc/cpuinfo
  elif command -v sysctl >/dev/null 2>&1; then
    sysctl -n hw.logicalcpu 2>/dev/null || sysctl -n hw.ncpu 2>/dev/null || echo 0
  else
    echo 0
  fi
}

# Prints: total_kb available_kb
host_mem_kb() {
  if [[ -r /proc/meminfo ]]; then
    awk '/MemTotal:/ {t=$2} /MemAvailable:/ {a=$2} END {print t+0, a+0}' /proc/meminfo
    return
  fi
  if command -v sysctl >/dev/null 2>&1; then
    local bytes page avail_pages
    bytes="$(sysctl -n hw.memsize 2>/dev/null || echo 0)"
    page="$(sysctl -n hw.pagesize 2>/dev/null || echo 4096)"
    # Darwin has no MemAvailable. free+inactive+speculative+purgeable is a
    # usable snapshot; vm.page_free_count alone looks like 100% used.
    if command -v vm_stat >/dev/null 2>&1; then
      avail_pages="$(vm_stat | awk '
        /Pages free:/ { f=$NF }
        /Pages inactive:/ { i=$NF }
        /Pages speculative:/ { s=$NF }
        /Pages purgeable:/ { p=$NF }
        END {
          gsub(/\./, "", f); gsub(/\./, "", i); gsub(/\./, "", s); gsub(/\./, "", p)
          print (f+0)+(i+0)+(s+0)+(p+0)
        }')"
      echo "$((bytes / 1024)) $((avail_pages * page / 1024))"
      return
    fi
    echo "$((bytes / 1024)) 0"
    return
  fi
  echo "0 0"
}

linux_cpu_busy_pct() {
  [[ -r /proc/stat ]] || return 0
  local a1 a2 i1 i2 t1
  a1="$(awk '/^cpu / {print $2+$3+$4+$5+$6+$7+$8}' /proc/stat)"
  i1="$(awk '/^cpu / {print $5}' /proc/stat)"
  sleep 1
  a2="$(awk '/^cpu / {print $2+$3+$4+$5+$6+$7+$8}' /proc/stat)"
  i2="$(awk '/^cpu / {print $5}' /proc/stat)"
  t1="$((a2 - a1))"
  if [[ "$t1" -le 0 ]]; then
    echo "?"
    return
  fi
  awk -v tot="$t1" -v idle="$((i2 - i1))" 'BEGIN { printf "%.0f%%", (1 - idle / tot) * 100 }'
}

educate_spec() {
  local cpus="$1"
  local ram="$2"
  cat >&2 <<EOF

$(echo -e "${RED}This host is below the floor for building images here.${NC}")

Hotly builds Next.js + Go on the machine (no prebuilt images). Plan for 2 vCPU / 4 GB;
on-box \`docker compose up --build\` can peak ~2.7 GB RAM.

Docker engine reports:  ${cpus} CPU(s),  ${ram}

Use a 2 vCPU / 4 GB (or larger) VPS, or give Docker Desktop / OrbStack at least
that much. Building on a smaller box usually OOMs.

If you only wanted to write .env on a tiny machine, pass --skip-spec (not for
production). Paste the "System (paste this in a GitHub issue)" block above.

EOF
  exit 1
}

# Always print this block so a screenshot/paste helps debug OSS installs.
report_and_gate_spec() {
  local engine_cpus=0 engine_mem=0
  local h_cpus h_tot h_avail load uname_s compose_v busy=""
  local used_pct mem_line machine server

  echo ""
  echo -e "${MUTED}--- System (paste this in a GitHub issue) ---${NC}"

  uname_s="$(uname -srm 2>/dev/null || uname -a)"
  compose_v="$(docker compose version 2>/dev/null | head -1 || echo missing)"
  load="$(uptime 2>/dev/null | sed -n 's/.*load averages*: //p')"
  [[ -z "$load" ]] && load="$(awk '{print $1", "$2", "$3}' /proc/loadavg 2>/dev/null || echo unknown)"

  engine_cpus="$(docker info --format '{{.NCPU}}' 2>/dev/null || echo 0)"
  engine_mem="$(docker info --format '{{.MemTotal}}' 2>/dev/null || echo 0)"
  engine_cpus="${engine_cpus:-0}"
  engine_mem="${engine_mem:-0}"

  h_cpus="$(host_cpus)"
  read -r h_tot h_avail <<<"$(host_mem_kb)"
  h_tot="${h_tot:-0}"
  h_avail="${h_avail:-0}"

  if [[ "$h_tot" -gt 0 ]]; then
    used_pct="$(awk -v t="$h_tot" -v a="$h_avail" 'BEGIN { if (t<=0) print "?"; else printf "%.0f", (t-a)*100/t }')"
    mem_line="$(fmt_gib $((h_tot * 1024))) total, $(fmt_gib $((h_avail * 1024))) available (~${used_pct}% in use)"
  else
    mem_line="unknown"
  fi

  if [[ -r /proc/stat ]]; then
    busy="$(linux_cpu_busy_pct)"
  fi

  echo "  uname:            ${uname_s}"
  machine="$(uname -m)"
  server="$(docker version --format '{{.Server.Arch}}' 2>/dev/null || echo unknown)"
  echo "  arch:             host ${machine} / docker ${server}"
  echo "  host CPUs:        ${h_cpus}"
  echo "  host RAM:         ${mem_line}"
  echo "  load average:     ${load}"
  if [[ -n "$busy" ]]; then
    echo "  CPU busy (1s):    ${busy}   (Linux /proc/stat sample — a screenshot of a quiet box can still be 0%)"
  fi
  echo "  Docker CPUs:      ${engine_cpus}   (what image builds actually use)"
  if [[ "$engine_mem" -gt 0 ]]; then
    echo "  Docker RAM:       $(fmt_gib "$engine_mem")"
  else
    echo "  Docker RAM:       unknown"
  fi
  echo "  Compose:          ${compose_v}"
  echo -e "${MUTED}--- end system ---${NC}"
  echo ""

  case "$machine" in
    x86_64 | amd64 | arm64 | aarch64) ;;
    *)
      warn "Unusual architecture (${machine}). Documented VPS path is amd64 Linux; the same Compose file also builds on arm64 (OrbStack / Apple Silicon)."
      ;;
  esac

  local ram_h
  ram_h="$(fmt_gib "$engine_mem")"
  # 4 GB class: some clouds advertise 4 GB but MemTotal is ~3.8 GiB.
  if [[ "$SKIP_SPEC" == true ]]; then
    warn "Skipping 2 vCPU / 4 GB gate (--skip-spec)."
    return
  fi
  if [[ "$engine_cpus" -eq 0 || "$engine_mem" -eq 0 ]]; then
    warn "Could not read Docker CPU/RAM; not gating. If builds OOM, paste the system block above."
    return
  fi
  if [[ "$engine_cpus" -lt 2 || "$engine_mem" -lt 3758096384 ]]; then
    educate_spec "$engine_cpus" "$ram_h"
  fi
}

is_ipv4() {
  local h="$1"
  [[ "$h" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]
}

env_get() {
  local key="$1"
  local file="${2:-$ROOT/.env}"
  [[ -f "$file" ]] || return 0
  awk -F= -v k="$key" '$1==k {sub(/^[^=]+=/,""); print; exit}' "$file" | tr -d '\r'
}

# Strip chrome that must never land in .env (ANSI, "current:" lines, wrapping quotes).
clean_env_val() {
  local val="$1"
  val="${val//$'\r'/}"
  val="$(printf '%s' "$val" | sed $'s/\x1b\\[[0-9;]*[A-Za-z]//g')"
  if [[ "$val" == *$'\n'* ]]; then
    val="$(printf '%s' "$val" | awk 'NF && $0 !~ /^[[:space:]]*current:/ { last=$0 } END { print last }')"
  fi
  if [[ ${#val} -ge 2 && ( "$val" == \'*\' || "$val" == \"*\" ) ]]; then
    val="${val:1:${#val}-2}"
  fi
  [[ "$val" == *\\ ]] && val="${val%\\}"
  printf '%s' "$val"
}

set_env() {
  local key="$1"
  local val
  val="$(clean_env_val "$2")"
  local file="$ROOT/.env"
  local tmp
  tmp="$(mktemp)"
  if [[ -f "$file" ]] && grep -q "^${key}=" "$file"; then
    awk -v k="$key" -v v="$val" 'index($0, k "=")==1 { print k "=" v; next } { print }' "$file" >"$tmp"
  else
    cat "$file" >"$tmp" 2>/dev/null || true
    printf '%s=%s\n' "$key" "$val" >>"$tmp"
  fi
  mv "$tmp" "$file"
}

prompt() {
  local message="$1"
  local current="${2:-}"
  local reply=""
  if [[ "$ASSUME_YES" == true ]]; then
    printf '%s' "$(clean_env_val "$current")"
    return
  fi
  # Labels stay on the read line so email vs display name cannot look the same.
  # UI must go to stderr: $(prompt) is the env value. v0.1.0 echoed a dim
  # "current:" line to stdout; Compose then refused .env (ESC in a variable name).
  if [[ -n "$current" ]]; then
    printf '  current: %s\n' "$current" >&2
    read -r -p "${message} " reply || true
    if [[ -z "$reply" ]]; then
      printf '%s' "$(clean_env_val "$current")"
      return
    fi
    printf '%s' "$(clean_env_val "$reply")"
    return
  fi
  read -r -p "${message} " reply || true
  printf '%s' "$(clean_env_val "$reply")"
}

yes_no() {
  local message="$1"
  local default="${2:-n}"
  local reply=""
  if [[ "$ASSUME_YES" == true ]]; then
    [[ "$default" == y ]]
    return
  fi
  while true; do
    read -r -p "$(echo -e "${MUTED}${message} [y/N]${NC} ")" reply || true
    reply="$(echo "$reply" | tr '[:upper:]' '[:lower:]')"
    if [[ -z "$reply" ]]; then
      reply="$default"
    fi
    case "$reply" in
      y | yes) return 0 ;;
      n | no) return 1 ;;
    esac
    warn "Answer y or n — not an API key or other paste."
  done
}

looks_nonempty() { [[ -n "${1:-}" ]]; }
looks_email() { [[ "${1:-}" == *@*.* ]]; }
looks_https_url() { [[ "${1:-}" == https://* ]]; }
looks_sg_key() { [[ "${1:-}" == SG.* ]]; }
looks_pk() { [[ "${1:-}" == pk_* ]]; }
looks_whsec() { [[ "${1:-}" == whsec_* ]]; }
looks_stripe_secret() {
  [[ "${1:-}" == sk_test_* || "${1:-}" == sk_live_* || "${1:-}" == rkcs_test_* || "${1:-}" == rkcs_live_* ]]
}

# stdout is the accepted value (for $(...)). Invalid current is discarded so Enter cannot keep a swapped key.
prompt_matching() {
  local message="$1"
  local current="${2:-}"
  local ok_fn="$3"
  local hint="$4"
  local val
  if [[ "$ASSUME_YES" == true ]]; then
    printf '%s' "$(clean_env_val "$current")"
    return
  fi
  current="$(clean_env_val "$current")"
  if [[ -n "$current" ]] && ! "$ok_fn" "$current"; then
    current=""
  fi
  while true; do
    val="$(prompt "$message" "$current")"
    if "$ok_fn" "$val"; then
      printf '%s' "$val"
      return
    fi
    warn "$hint"
    current=""
  done
}

need_secret() {
  local val="$1"
  [[ -z "$val" || "$val" == *local-dev-only* || "$val" == *changeme* || "$val" == *change-me* ]]
}

ensure_env_file() {
  if [[ ! -f "$ROOT/.env" ]]; then
    cp "$ROOT/.env.example" "$ROOT/.env"
    info "Created .env from .env.example"
  fi
}

generate_secrets() {
  local session recovery rpc access secret
  session="$(env_get SESSION_SECRET)"
  recovery="$(env_get RECOVERY_TOKEN_SECRET)"
  rpc="$(env_get GARAGE_RPC_SECRET)"
  access="$(env_get S3_ACCESS_KEY)"
  secret="$(env_get S3_SECRET_KEY)"
  if need_secret "$session"; then
    set_env SESSION_SECRET "$(openssl rand -base64 32 | tr -d '\n')"
    info "Generated SESSION_SECRET"
  fi
  if need_secret "$recovery"; then
    set_env RECOVERY_TOKEN_SECRET "$(openssl rand -base64 32 | tr -d '\n')"
    info "Generated RECOVERY_TOKEN_SECRET"
  fi
  if need_secret "$rpc" || [[ ${#rpc} -lt 32 ]]; then
    set_env GARAGE_RPC_SECRET "$(openssl rand -hex 32)"
    info "Generated GARAGE_RPC_SECRET"
  fi
  if need_secret "$access" || [[ "$access" != GK* ]]; then
    set_env S3_ACCESS_KEY "GK$(openssl rand -hex 16)"
    info "Generated S3_ACCESS_KEY"
  fi
  if need_secret "$secret"; then
    set_env S3_SECRET_KEY "$(openssl rand -hex 32)"
    info "Generated S3_SECRET_KEY"
  fi
}

configure_origin() {
  local public caddy host public_q
  public="$(env_get PUBLIC_APP_URL)"
  [[ -z "$public" ]] && public="http://localhost"
  echo ""
  info "Browsers, recovery mail, Stripe return URLs, and SEO all use PUBLIC_APP_URL."
  info "That must be the hostname guests will type — not :3000 or :8080."
  if [[ "$ASSUME_YES" == true ]]; then
    set_env PUBLIC_APP_URL "$public"
    set_env NEXT_PUBLIC_SERVER_URL "${public%/}/api"
    if [[ "$public" == http://localhost* || "$public" == http://127.0.0.1* ]]; then
      set_env CADDY_SITE "http://:80"
    fi
    return
  fi
  if yes_no "Is this a public VPS with a real hostname?" n; then
    while true; do
      public_q="$(prompt_matching "Public URL (https://your.domain.example):" "$public" looks_https_url "Use https://your.domain.example — not http://, not a raw IP, not :3000.")"
      host="${public_q#http://}"
      host="${host#https://}"
      host="${host%%/*}"
      if is_ipv4 "$host" || [[ "$public_q" == https://[0-9]* ]]; then
        warn "A raw IP is not a production origin. Point DNS at this box (Cloudflare: DNS only until the cert exists), then use https://your.domain.example"
        public=""
        continue
      fi
      break
    done
    set_env PUBLIC_APP_URL "$public_q"
    set_env NEXT_PUBLIC_SERVER_URL "${public_q%/}/api"
    set_env CADDY_SITE "$host"
  else
    public_q="$(prompt "Local origin:" "$public")"
    [[ -z "$public_q" ]] && public_q="http://localhost"
    host="${public_q#http://}"
    host="${host#https://}"
    host="${host%%/*}"
    if is_ipv4 "$host"; then
      fail "Even locally, prefer http://localhost over a raw IP so cookies and recovery links match the browser."
    fi
    set_env PUBLIC_APP_URL "$public_q"
    set_env NEXT_PUBLIC_SERVER_URL "${public_q%/}/api"
    set_env CADDY_SITE "http://:80"
  fi
}

configure_creator() {
  local email name
  echo ""
  info "Exactly one creator per install. That email is the only Google account that can open /creator."
  email="$(prompt_matching "Creator email:" "$(env_get CREATOR_EMAIL)" looks_email "That is not an email. Use the Google account that will own /creator.")"
  set_env CREATOR_EMAIL "$email"
  info "Display name is the public name on /penpal, not the Google email."
  name="$(prompt_matching "Display name:" "$(env_get CREATOR_DISPLAY_NAME)" looks_nonempty "Display name is the public /penpal name, not the Google email.")"
  set_env CREATOR_DISPLAY_NAME "$name"
}

write_firebase_override() {
  cat >"$ROOT/docker-compose.override.yml" <<'YAML'
services:
  server:
    volumes:
      - ./.secrets/firebase.json:/run/secrets/firebase.json:ro
YAML
}

configure_firebase() {
  local project api auth json
  echo ""
  info "Firebase: Google sign-in for the creator and Dome members."
  info "Console: https://console.firebase.google.com/  → project settings → your apps / service accounts"
  info "Add this hostname to Authentication → Settings → Authorized domains."
  if [[ "$SKIP_FIREBASE" == true ]]; then
    info "Skipping Firebase (--skip-firebase). Sign-in stays off until you re-run."
    return
  fi
  if ! yes_no "Configure Firebase now?" n; then
    info "Skipped. /auth/firebase will say it is not configured."
    return
  fi
  project="$(prompt_matching "Firebase project id:" "$(env_get FIREBASE_PROJECT_ID)" looks_nonempty "Project id cannot be empty.")"
  api="$(prompt_matching "Web API key:" "$(env_get FIREBASE_WEB_API_KEY)" looks_nonempty "Web API key cannot be empty.")"
  auth="$(prompt_matching "Auth domain (project.firebaseapp.com):" "$(env_get FIREBASE_AUTH_DOMAIN)" looks_nonempty "Auth domain cannot be empty (usually project.firebaseapp.com).")"
  set_env FIREBASE_PROJECT_ID "$project"
  set_env FIREBASE_WEB_API_KEY "$api"
  set_env FIREBASE_AUTH_DOMAIN "$auth"
  echo ""
  info "Paste the full service-account JSON (not a file path). End with a line that is only: END"
  json=""
  while true; do
    json=""
    while IFS= read -r line; do
      [[ "$line" == "END" ]] && break
      json+="$line"$'\n'
    done
    if [[ "$json" == *'"type": "service_account"'* || "$json" == *'"type":"service_account"'* ]]; then
      break
    fi
    warn "That did not look like a Firebase service-account JSON. Paste the whole file again, then a line that is only END."
  done
  mkdir -p "$ROOT/.secrets"
  printf '%s' "$json" >"$ROOT/.secrets/firebase.json"
  chmod 644 "$ROOT/.secrets/firebase.json"
  write_firebase_override
  set_env FIREBASE_CREDENTIALS_JSON "/run/secrets/firebase.json"
  info "Wrote .secrets/firebase.json (chmod 644 so the container user hotly can read it)."
}

configure_stripe() {
  local sk pk wh
  echo ""
  info "Stripe: Checkout amounts are server USD cents. Guests pay your account."
  info "Dashboard webhook URL: $(env_get PUBLIC_APP_URL)/api/webhooks/stripe"
  info "Enable only: checkout.session.completed, checkout.session.async_payment_succeeded,"
  info "checkout.session.async_payment_failed, checkout.session.expired,"
  info "customer.subscription.created, customer.subscription.updated, customer.subscription.deleted,"
  info "invoice.paid, invoice.payment_succeeded. Not listen-to-all. Docs: docs/operations.md"
  info "Local CLI listen uses a whsec_ from \`stripe listen\`, not the Dashboard secret."
  info "https://dashboard.stripe.com/apikeys"
  if [[ "$SKIP_STRIPE" == true ]]; then
    info "Skipping Stripe (--skip-stripe)."
    return
  fi
  if ! yes_no "Configure Stripe now?" n; then
    info "Skipped. /penpal Checkout stays off until you re-run."
    return
  fi
  sk="$(prompt_matching "Secret key (sk_test_… / sk_live_… / rkcs_…):" "$(env_get STRIPE_SECRET_KEY)" looks_stripe_secret "Secret must start with sk_test_, sk_live_, rkcs_test_, or rkcs_live_ — no wrapping quotes.")"
  pk="$(prompt_matching "Publishable key (pk_…):" "$(env_get STRIPE_PUBLISHABLE_KEY)" looks_pk "Publishable key must start with pk_ — not the webhook secret.")"
  wh="$(prompt_matching "Webhook signing secret (whsec_…):" "$(env_get STRIPE_WEBHOOK_SECRET)" looks_whsec "Webhook secret must start with whsec_ — Dashboard endpoint for this hostname, not stripe listen, not a pk_ key.")"
  set_env STRIPE_SECRET_KEY "$sk"
  set_env STRIPE_PUBLISHABLE_KEY "$pk"
  set_env STRIPE_WEBHOOK_SECRET "$wh"
  warn "If Checkout in India shows INR, click US USD — the charge is still the server USD amount."
}

configure_sendgrid() {
  local key from name
  echo ""
  info "SendGrid: recovery + creator/guest notices. Key must start with SG. (not a Twilio SK… SID)."
  info "API keys: https://app.sendgrid.com/settings/api_keys"
  info "Verify a single sender: https://app.sendgrid.com/settings/sender_auth"
  if [[ "$SKIP_SENDGRID" == true ]]; then
    info "Skipping SendGrid (--skip-sendgrid)."
    return
  fi
  if ! yes_no "Configure SendGrid now?" n; then
    info "Skipped. Recovery mail stays off until you re-run."
    return
  fi
  key="$(prompt_matching "API key (SG.…):" "$(env_get SENDGRID_API_KEY)" looks_sg_key "That key does not start with SG. Answer the [y/N] with y first, then paste a Mail Send key (not a Twilio SK… SID).")"
  from="$(prompt_matching "From email (verified sender):" "$(env_get SENDGRID_FROM_EMAIL)" looks_email "From email must look like an address (verified sender).")"
  name="$(prompt_matching "From name:" "$(env_get SENDGRID_FROM_NAME)" looks_nonempty "From name cannot be empty.")"
  set_env SENDGRID_API_KEY "$key"
  set_env SENDGRID_FROM_EMAIL "$from"
  set_env SENDGRID_FROM_NAME "$name"
}

compose_up() {
  local files=(-f docker-compose.yml)
  local site
  site="$(env_get CADDY_SITE)"
  if [[ "$site" != http://:80 && "$site" != http://* ]]; then
    files+=(-f docker-compose.prod.yml)
    info "Using docker-compose.prod.yml (only 80/443 published)."
  fi
  if [[ -f "$ROOT/docker-compose.override.yml" ]]; then
    files+=(-f docker-compose.override.yml)
  fi
  echo ""
  info "Starting Compose (build, no down -v — volumes stay)."
  (cd "$ROOT" && docker compose "${files[@]}" up --build -d --force-recreate)
  info "Waiting for /api/health …"
  local i
  for i in $(seq 1 60); do
    if curl -fsS "$(env_get PUBLIC_APP_URL)/api/health" >/dev/null 2>&1; then
      echo -e "${MUTED}Healthy at ${NC}$(env_get PUBLIC_APP_URL)/api/health"
      return
    fi
    sleep 2
  done
  warn "Compose is up but health did not pass yet. Check: docker compose logs -f server web caddy"
}

finish() {
  echo ""
  echo -e "${MUTED}Backups are on you.${NC} Postgres and media live in Docker volumes on this machine."
  echo "Nothing is replicated. See docs/operations.md (backup/restore)."
  echo ""
  echo "This install:  $ROOT"
  echo ".env:          $ROOT/.env"
  echo "Re-run to rotate a key or fill a skipped provider:"
  echo "  cd \"$ROOT\" && ./scripts/install.sh --local"
  echo "Never: docker compose down -v  (that deletes guest data)."
  echo ""
}

choose_install_dir() {
  local default reply
  default="${INSTALL_DIR:-${HOTLY_ROOT:-$HOME/hotly-os}}"
  if [[ -z "${INSTALL_DIR:-}" ]]; then
    if [[ "$ASSUME_YES" == true ]]; then
      INSTALL_DIR="$default"
    else
      printf '  default: %s\n' "$default" >&2
      info "Curl installs unpack here (not /tmp). .env will be ${default}/.env"
      read -r -p "Install directory: " reply </dev/tty || true
      if [[ -n "$reply" ]]; then
        INSTALL_DIR="$reply"
      else
        INSTALL_DIR="$default"
      fi
    fi
  fi
  INSTALL_DIR="${INSTALL_DIR/#\~/$HOME}"
  mkdir -p "$INSTALL_DIR" || fail "Cannot create $INSTALL_DIR"
  INSTALL_DIR="$(cd "$INSTALL_DIR" && pwd)"
}

fetch_release() {
  command -v curl >/dev/null 2>&1 && command -v tar >/dev/null 2>&1 || educate_curl_tar
  [[ -n "$GITHUB_REPO" ]] || educate_no_release
  [[ -n "$TAG" && "$TAG" != latest ]] || fail "Set --tag v0.1.4 (or HOTLY_TAG). Do not pin latest — that is a drifting install."
  local url tmp dir pass=()
  choose_install_dir
  if [[ -f "$INSTALL_DIR/docker-compose.yml" && -f "$INSTALL_DIR/scripts/install.sh" ]]; then
    info "Using existing tree at $INSTALL_DIR"
  else
    url="https://github.com/${GITHUB_REPO}/archive/refs/tags/${TAG}.tar.gz"
    tmp="$(mktemp -d)"
    info "Downloading ${url}"
    curl -fsSL "$url" -o "$tmp/src.tar.gz" || fail "Could not download ${url}
Create a GitHub Release tag first, or use --local from a checkout."
    tar -xzf "$tmp/src.tar.gz" -C "$tmp"
    dir="$(find "$tmp" -maxdepth 1 -type d ! -path "$tmp" | head -1)"
    [[ -f "$dir/scripts/install.sh" ]] || fail "Archive did not contain scripts/install.sh"
    info "Unpacking to $INSTALL_DIR"
    cp -a "$dir"/. "$INSTALL_DIR"/
    rm -rf "$tmp"
  fi
  [[ -f "$INSTALL_DIR/scripts/install.sh" ]] || fail "No scripts/install.sh in $INSTALL_DIR"
  [[ "$SKIP_FIREBASE" == true ]] && pass+=(--skip-firebase)
  [[ "$SKIP_STRIPE" == true ]] && pass+=(--skip-stripe)
  [[ "$SKIP_SENDGRID" == true ]] && pass+=(--skip-sendgrid)
  [[ "$SKIP_UP" == true ]] && pass+=(--skip-up)
  [[ "$SKIP_SPEC" == true ]] && pass+=(--skip-spec)
  [[ "$ASSUME_YES" == true ]] && pass+=(--yes)
  HOTLY_INSTALL_INNER=1 exec bash "$INSTALL_DIR/scripts/install.sh" --local "${pass[@]}" </dev/tty
}

# --- start ---

if [[ "${HOTLY_INSTALL_INNER:-}" != 1 ]] && ! { script_on_disk && find_root_from_script; } && [[ "$SKIP_DOWNLOAD" != true ]]; then
  fetch_release
fi

if script_on_disk && find_root_from_script; then
  ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
  SKIP_DOWNLOAD=true
elif [[ "$SKIP_DOWNLOAD" == true ]]; then
  ROOT="$(pwd)"
  [[ -f "$ROOT/docker-compose.yml" ]] || fail "No docker-compose.yml in $(pwd). cd into this checkout or omit --local and download a Release."
else
  fetch_release
fi

echo ""
echo -e "${MUTED}Hotly installer${NC}  ${ROOT}"
gate_docker
report_and_gate_spec
command -v openssl >/dev/null 2>&1 || fail "openssl is required to generate SESSION_SECRET and Garage keys."
ensure_env_file
configure_origin
configure_creator
generate_secrets
configure_firebase
configure_stripe
configure_sendgrid
if [[ "$SKIP_UP" == true ]]; then
  info "Skipping docker compose (--skip-up)."
  echo "When ready: cd \"$ROOT\" && docker compose up --build -d"
else
  compose_up
fi
finish
