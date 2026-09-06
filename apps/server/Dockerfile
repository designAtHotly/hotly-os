# syntax=docker/dockerfile:1
# Build from apps/server:
#   docker build -f apps/server/Dockerfile apps/server

FROM golang:1.27-bookworm AS builder
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/server .

FROM alpine:3.24
RUN apk add --no-cache ca-certificates tzdata wget \
  && addgroup -S hotly \
  && adduser -S -G hotly hotly
WORKDIR /var/lib/hotly
COPY --from=builder /out/server /usr/local/bin/server
USER hotly
EXPOSE 8080
ENV PORT=8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/health || exit 1
CMD ["/usr/local/bin/server"]
