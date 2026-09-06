"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Plus, Loader2 } from "lucide-react";
import { useCreator } from "@/hooks/useCreator";
import {
  getCommunityByCreator,
  getCommunityPromptsWithNoteCount,
  getCommunityMembers,
  createCommunityPrompt,
  createCommunity,
} from "@/lib/api/community";
import type { Community, CommunityPromptWithNoteCount, CommunityMember } from "@/lib/api/community";
import { sanitizePrompt } from "@/lib/utils/sanitize-prompt";
import { captureError } from "@/lib/utils/error-handler";
import confetti from "canvas-confetti";
import { useDashboardUI } from "@/contexts/DashboardUIContext";
import { appMediaUrl } from "@/lib/media/url";

type Tab = "prompts" | "members";

const COMMUNITY_PROMPT_DATE_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

// ============================================
// Loading Skeleton
// ============================================
function CommunitySkeleton() {
  return (
    <div className="max-w-2xl mx-auto px-4 pt-6 pb-8 md:px-6 md:pt-8 animate-pulse">
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="h-[72px] bg-gray-100 rounded-xl" />
        <div className="h-[72px] bg-gray-100 rounded-xl" />
      </div>
      <div className="flex gap-2 mb-4">
        <div className="h-9 w-24 bg-gray-100 rounded-xl" />
        <div className="h-9 w-24 bg-gray-100 rounded-xl" />
      </div>
      <div className="space-y-3">
        <div className="h-24 bg-gray-100 rounded-2xl" />
        <div className="h-24 bg-gray-100 rounded-2xl" />
        <div className="h-24 bg-gray-100 rounded-2xl" />
      </div>
    </div>
  );
}

// ============================================
// Create Community (no community yet)
// ============================================
function CreateCommunityView({
  onCreated,
}: {
  onCreated: (community: Community, prompt: CommunityPromptWithNoteCount) => void;
}) {
  const [firstPrompt, setFirstPrompt] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!firstPrompt.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const res = await createCommunity({ title: "", first_prompt: firstPrompt.trim() });
      if (res.body) {
        onCreated(res.body.community, { ...res.body.prompt, note_count: 0 });
        confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
      } else {
        setError("Failed to create community");
      }
    } catch (err) {
      captureError(err, { component: "CommunityPage", action: "create_community" });
      setError("Failed to create community");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 pt-6 md:px-6 md:pt-8">
      <div className="bg-white rounded-2xl p-8 shadow-sm text-center">
        <span className="text-4xl block mb-3">🏠</span>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Create your community</h2>
        <p className="text-sm text-gray-500 mb-6">
          Write the first prompt for your community. This is the question your audience will respond to.
        </p>
        <div className="max-w-sm mx-auto space-y-4">
          <div className="relative">
            <textarea
              value={firstPrompt}
              onChange={(e) => { const v = sanitizePrompt(e.target.value); if (v.length <= 280) setFirstPrompt(v); }}
              placeholder="e.g. What's one thing that made you smile today?"
              maxLength={280}
              rows={3}
              autoFocus
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-base text-gray-900 focus:outline-none focus:bg-white focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 resize-none"
            />
            <span className={`absolute bottom-2 right-3 text-xs ${firstPrompt.length >= 260 ? "text-red-500" : "text-gray-400"}`}>
              {firstPrompt.length}/280
            </span>
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <button
            onClick={handleCreate}
            disabled={creating || !firstPrompt.trim()}
            className="w-full py-3 bg-gray-900 text-white text-sm font-semibold rounded-xl hover:bg-gray-800 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {creating && <Loader2 className="w-4 h-4 animate-spin" />}
            {creating ? "Creating..." : "Create Community"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Just Created Success View
// ============================================
function CommunityCreatedView({
  communityUrl,
  onContinue,
}: {
  communityUrl: string;
  onContinue: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(communityUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* noop */ }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 pt-6 md:px-6 md:pt-8 flex flex-col items-center justify-center min-h-[60vh] text-center">
      <div className="text-5xl mb-4">🎉</div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Your community is live!</h2>
      <p className="text-sm text-gray-500 mb-8">Share this link with your audience to get them to join.</p>
      <CopyLinkCard url={communityUrl} copied={copied} onCopy={copyLink} label="Your community link" />
      <button
        onClick={onContinue}
        className="mt-3 w-full max-w-sm py-2.5 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
      >
        Go to dashboard →
      </button>
    </div>
  );
}

// ============================================
// Copy Link Card (reused in multiple places)
// ============================================
function CopyLinkCard({
  url,
  copied,
  onCopy,
  label,
}: {
  url: string;
  copied: boolean;
  onCopy: () => void;
  label?: string;
}) {
  return (
    <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm p-5 space-y-3">
      {label && <label className="block text-xs font-medium text-gray-500 text-left">{label}</label>}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={url}
          readOnly
          className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-700 focus:outline-none"
        />
        <button
          onClick={onCopy}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors shrink-0 ${
            copied ? "bg-green-100 text-green-700" : "bg-amber-500 text-white hover:bg-amber-600"
          }`}
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
    </div>
  );
}

// ============================================
// Share Modal
// ============================================
function ShareModal({
  url,
  onClose,
}: {
  url: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* noop */ }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-3">
            <span className="text-2xl">👥</span>
          </div>
          <h3 className="text-xl font-bold text-gray-900">Share Your Community</h3>
          <p className="text-sm text-gray-500 mt-1">Invite your audience to join</p>
        </div>
        <div className="bg-gray-50 rounded-xl p-4 mb-4">
          <label className="block text-xs font-medium text-gray-500 mb-2">Your community link</label>
          <div className="flex items-center gap-2">
            <input type="text" value={url} readOnly className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none" />
            <button
              onClick={copyLink}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                copied ? "bg-green-100 text-green-700" : "bg-amber-500 text-white hover:bg-amber-600"
              }`}
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>
        <p className="text-xs text-gray-400 text-center">
          Share this link on social media, your website, or anywhere your fans can find you
        </p>
      </div>
    </div>
  );
}

// ============================================
// Prompt Created Modal
// ============================================
function PromptCreatedModal({
  url,
  onClose,
}: {
  url: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* noop */ }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white w-full sm:max-w-md sm:mx-4 rounded-t-2xl sm:rounded-2xl shadow-xl p-6">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <div className="text-center mb-5">
          <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-3">
            <span className="text-2xl">💬</span>
          </div>
          <h3 className="text-lg font-bold text-gray-900">Prompt created!</h3>
          <p className="text-sm text-gray-500 mt-1">Share your community link to get responses</p>
        </div>
        <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 mb-4">
          <span className="flex-1 text-sm text-gray-700 truncate">{url}</span>
          <button
            onClick={copyLink}
            className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              copied ? "bg-green-100 text-green-700" : "bg-amber-500 text-white hover:bg-amber-600"
            }`}
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Stats Row
// ============================================
function CommunityStats({ promptCount, memberCount }: { promptCount: number; memberCount: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 mb-6">
      <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200/60 rounded-xl px-4 py-3 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
          <span className="text-lg">💬</span>
        </div>
        <div>
          <p className="text-sm font-bold text-gray-800">Prompts</p>
          <p className="text-2xl font-bold text-amber-700 tabular-nums">{promptCount}</p>
        </div>
      </div>
      <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200/60 rounded-xl px-4 py-3 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center shrink-0">
          <span className="text-lg">👥</span>
        </div>
        <div>
          <p className="text-sm font-bold text-gray-800">Members</p>
          <p className="text-2xl font-bold text-green-700 tabular-nums">{memberCount}</p>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Prompt Card
// ============================================
function PromptCard({ prompt, communityUrl }: { prompt: CommunityPromptWithNoteCount; communityUrl: string }) {
  const promptUrl = `${communityUrl}/${prompt.share_slug}`;

  return (
    <Link
      href={`/creator/dome`}
      className="block bg-white rounded-2xl px-5 py-5 shadow-sm hover:shadow-md transition-shadow"
    >
      <p className="text-[15px] text-gray-900 font-medium leading-relaxed">{prompt.content}</p>
      <div className="flex items-center gap-3 mt-3">
        <span className="text-xs text-gray-400">{COMMUNITY_PROMPT_DATE_FORMATTER.format(new Date(prompt.created_at))}</span>
        <span className="text-xs text-gray-400">·</span>
        <span className="text-xs text-gray-500 font-medium">
          {prompt.note_count} {prompt.note_count === 1 ? "response" : "responses"}
        </span>
        <span className="flex-1" />
        <a
          href={promptUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="text-xs text-amber-600 font-medium hover:text-amber-700 transition-colors flex items-center gap-1"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
          Open
        </a>
      </div>
    </Link>
  );
}

// ============================================
// Member Card
// ============================================
function MemberCard({ member }: { member: CommunityMember }) {
  return (
    <div className="bg-white rounded-2xl px-5 py-4 shadow-sm flex items-center gap-4">
      {appMediaUrl(member.avatar_url) ? (
        <img src={appMediaUrl(member.avatar_url)} alt={member.name || "Member"} width={44} height={44} className="w-11 h-11 rounded-full object-cover shrink-0" />
      ) : (
        <div className="w-11 h-11 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
          <span className="text-amber-600 text-sm font-bold">{(member.name || member.email).charAt(0).toUpperCase()}</span>
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-[15px] font-semibold text-gray-900 truncate">{member.name || "Anonymous"}</p>
        <p className="text-xs text-gray-400 truncate mt-0.5">{member.email}</p>
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        {member.role && (
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
            member.role === "admin" ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-500"
          }`}>
            {member.role}
          </span>
        )}
        <span className="text-[11px] text-gray-400">
          {new Date(member.joined_at).toLocaleDateString()}
        </span>
      </div>
    </div>
  );
}

// ============================================
// Add Prompt Input
// ============================================
function AddPromptInput({
  onAdd,
  onCancel,
}: {
  onAdd: (content: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [value, setValue] = useState("");
  const [adding, setAdding] = useState(false);

  const handleAdd = async () => {
    if (!value.trim() || adding) return;
    setAdding(true);
    try {
      await onAdd(value.trim());
      setValue("");
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm">
      <div className="relative">
        <textarea
          value={value}
          onChange={(e) => { const v = sanitizePrompt(e.target.value); if (v.length <= 280) setValue(v); }}
          placeholder="Write a new prompt for your community..."
          maxLength={280}
          rows={3}
          autoFocus
          className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-base text-gray-900 focus:outline-none focus:bg-white focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 resize-none"
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !adding) { e.preventDefault(); handleAdd(); } }}
        />
        <span className={`absolute bottom-2 right-3 text-xs ${value.length >= 260 ? "text-red-500" : "text-gray-400"}`}>
          {value.length}/280
        </span>
      </div>
      <div className="flex justify-end gap-2 mt-3">
        <button
          onClick={onCancel}
          disabled={adding}
          className="px-4 py-2.5 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleAdd}
          disabled={adding || !value.trim()}
          className="px-5 py-2.5 bg-amber-500 text-white text-sm font-semibold rounded-xl hover:bg-amber-600 transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Add Prompt
        </button>
      </div>
    </div>
  );
}

// ============================================
// Main Page
// ============================================
export default function CreatorDomeScreen() {
  const { creator } = useCreator();
  const { setHideShare } = useDashboardUI();
  const [community, setCommunity] = useState<Community | null>(null);
  const [prompts, setPrompts] = useState<CommunityPromptWithNoteCount[]>([]);
  const [members, setMembers] = useState<CommunityMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("prompts");
  const [showPromptInput, setShowPromptInput] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [justCreated, setJustCreated] = useState(false);
  const [promptShareModalOpen, setPromptShareModalOpen] = useState(false);

  const communityUrl = typeof window !== "undefined" && creator
    ? `${window.location.origin}/dome`
    : "";

  useEffect(() => {
    setHideShare(loading || !community);
  }, [loading, community, setHideShare]);

  useEffect(() => {
    if (!creator?.uuid) return;
    setLoading(true);
    getCommunityByCreator(creator.uuid)
      .then(async (res) => {
        if (!res.body) return;
        setCommunity(res.body);
        const [promptsRes, membersRes] = await Promise.all([
          getCommunityPromptsWithNoteCount(res.body.uuid),
          getCommunityMembers(res.body.uuid),
        ]);
        if (promptsRes.body) setPrompts(promptsRes.body);
        if (membersRes.body) setMembers(membersRes.body);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [creator?.uuid]);

  const handleAddPrompt = async (content: string) => {
    if (!community) return;
    const res = await createCommunityPrompt({ community_uuid: community.uuid, content });
    if (res.body) {
      setPrompts((prev) => [{ ...res.body!, note_count: 0 }, ...prev]);
      setShowPromptInput(false);
      setPromptShareModalOpen(true);
    }
  };

  if (loading) return <CommunitySkeleton />;

  if (!community) {
    return (
      <CreateCommunityView
        onCreated={(c, p) => {
          setCommunity(c);
          setPrompts([p]);
          setJustCreated(true);
        }}
      />
    );
  }

  if (justCreated) {
    return <CommunityCreatedView communityUrl={communityUrl} onContinue={() => setJustCreated(false)} />;
  }

  return (
    <div className="max-w-2xl mx-auto px-4 pt-6 pb-8 md:px-6 md:pt-8">
      {/* Header — hidden on mobile */}
      <div className="hidden lg:flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-900">Community</h1>
        <button
          onClick={() => setShowShareModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
          </svg>
          Share
        </button>
      </div>

      {showShareModal && <ShareModal url={communityUrl} onClose={() => setShowShareModal(false)} />}

      <CommunityStats promptCount={prompts.length} memberCount={members.length} />

      {/* Tabs */}
      <div className="flex items-center gap-2 mb-4">
        {(["prompts", "members"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
              activeTab === tab
                ? "bg-amber-100 text-amber-700 border-2 border-amber-400"
                : "bg-white text-gray-500 border-2 border-transparent hover:bg-gray-50"
            }`}
          >
            {tab === "prompts" ? "Prompts" : "Members"}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="space-y-3">
        {activeTab === "prompts" ? (
          <>
            {showPromptInput ? (
              <AddPromptInput
                onAdd={handleAddPrompt}
                onCancel={() => setShowPromptInput(false)}
              />
            ) : (
              <button
                onClick={() => setShowPromptInput(true)}
                className="w-full flex items-center justify-center gap-2 py-3 bg-white rounded-2xl shadow-sm text-sm font-semibold text-amber-700 hover:bg-amber-50 transition-colors"
              >
                <Plus className="w-4 h-4" />
                New Prompt
              </button>
            )}

            {prompts.map((p) => <PromptCard key={p.uuid} prompt={p} communityUrl={communityUrl} />)}

            {prompts.length === 0 && (
              <div className="bg-white rounded-2xl p-8 shadow-sm text-center">
                <span className="text-4xl block mb-3">💬</span>
                <p className="text-gray-600 font-medium">No prompts yet</p>
              </div>
            )}
          </>
        ) : (
          <>
            {members.map((m) => <MemberCard key={m.id} member={m} />)}

            {members.length === 0 && (
              <div className="bg-white rounded-2xl p-8 shadow-sm text-center">
                <span className="text-4xl block mb-3">👥</span>
                <p className="text-gray-600 font-medium">No members yet</p>
              </div>
            )}
          </>
        )}
      </div>

      {promptShareModalOpen && (
        <PromptCreatedModal url={communityUrl} onClose={() => setPromptShareModalOpen(false)} />
      )}
    </div>
  );
}
