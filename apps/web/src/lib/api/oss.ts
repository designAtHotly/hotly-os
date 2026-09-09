import { appMediaUrl } from "@/lib/media/url";
import type { BrandVariant } from "@/lib/utils/variant";
import type { CoffeeCreator, CreatorPricing } from "@/types/coffee.types";

import type { ChatMessage, CreatorChatResponse } from "./chat-types";
import { apiCall, ok } from './impl/base';
import type { ApiResponse } from './impl/base';

export type { CoffeeCreator };

export interface CheckoutResponse {
  url: string;
  session_id?: string;
}

export interface AuthCreator {
  id: number;
  uuid: string;
  user_id: number;
  username: string;
  bio?: string;
  created_at: string;
  name?: string;
  avatar_url?: string;
  email: string;
  variant?: BrandVariant;
  support_theme?: string;
  chat_attachment_policy?: string;
  response_day?: string;
}

function sanitizeAttachment(
  attachment: ChatMessageAttachment
): ChatMessageAttachment {
  return {
    ...attachment,
    signed_thumbnail_url: appMediaUrl(attachment.signed_thumbnail_url) ?? null,
    signed_url: appMediaUrl(attachment.signed_url),
  };
}

function sanitizeAttachments(
  attachments?: ChatMessageAttachment[] | null
): ChatMessageAttachment[] | undefined {
  if (!attachments) {
    return attachments ?? undefined;
  }
  return attachments.map(sanitizeAttachment);
}

export interface ChatMessageAttachment {
  signed_url?: string;
  signed_thumbnail_url?: string | null;
  filename: string;
  size: number;
  type: string;
}

export interface ChatAttachmentRequest {
  url: string;
  thumbnail_url?: string;
  filename: string;
  size: number;
  type: string;
}

export interface ApiCreatorChat {
  id: number;
  uuid: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  fan_user_id: number;
  fan_name: string;
  fan_avatar_url: string | null;
  last_message_id: number | null;
  last_message_uuid: string | null;
  last_message_content: string | null;
  last_message_sender_id: number | null;
  last_message_created_at: string | null;
  prev_message_content: string | null;
  prev_message_sender_id: number | null;
  last_fan_message_content: string | null;
  last_message_payment_cents: number | null;
  last_message_product_name: string | null;
  is_subscriber: boolean;
  subscription_amount_cents: number | null;
  total_paid_cents: number;
  currency_code: string;
  last_message_attachments?: ChatMessageAttachment[];
  blocked_at: string | null;
}

export interface ApiDashboardStats {
  total_earned: number;
  penpal_count: number;
  total_supporters: number;
  pending_replies: number;
}

export interface ApiEarningsByCurrency {
  currency_code: string;
  amount_cents: number;
}

export interface ApiGrantsByCurrency {
  currency_code: string;
  amount_cents: number;
}

export interface ApiMRRByCurrency {
  currency_code: string;
  amount_cents: number;
}

export interface ApiDashboardResponse {
  chats: ApiCreatorChat[];
  stats: ApiDashboardStats;
  earnings_by_currency: ApiEarningsByCurrency[];
  earnings_by_currency_this_month: ApiEarningsByCurrency[];
  grants_by_currency: ApiGrantsByCurrency[];
  referral_count: number;
  referral_earnings_by_currency: ApiEarningsByCurrency[];
  active_subscriber_count: number;
  mrr_by_currency: ApiMRRByCurrency[];
}

export interface ApiChatMessage {
  id: string;
  content: string;
  sender_id: number;
  sender_name: string | null;
  is_creator: boolean;
  amount_cents: number | null;
  currency_code: string | null;
  tier: string | null;
  attachments?: ChatMessageAttachment[];
  created_at: string;
}

export interface Community {
  id: number;
  uuid: string;
  creator_id: number;
  title: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface CommunityPrompt {
  id: number;
  uuid: string;
  community_id: number;
  content: string;
  share_slug: string;
  emoji: string | null;
  shape: string | null;
  color: string | null;
  created_at: string;
  updated_at: string;
}

export interface CommunityPromptWithNoteCount extends CommunityPrompt {
  note_count: number;
}

export interface CommunityNote {
  id: number;
  uuid: string;
  share_slug: string;
  community_id: number;
  prompt_id: number | null;
  author_id: number;
  parent_id: number | null;
  parent_uuid: string | null;
  content: string;
  emoji: string | null;
  shape: string | null;
  color: string | null;
  is_anonymous: boolean;
  created_at: string;
  updated_at: string;
  author_name?: string;
  author_avatar_url?: string;
}

export interface CommunityMember {
  id: number;
  name: string | null;
  email: string;
  avatar_url: string | null;
  role?: string;
  joined_at: string;
}

export interface CommunityNotesV2Response {
  total_count: number;
  notes: CommunityNote[];
}

export async function createCoffeeCheckoutSession(params: {
  creator_username?: string;
  amount?: number;
  message?: string;
  recurring?: boolean;
  success_url?: string;
  cancel_url?: string;
  product_name?: string;
  currency_code?: string;
  email?: string;
  tier?: string;
  custom_amount_cents?: number;
}): Promise<ApiResponse<CheckoutResponse>> {
  return apiCall("/api/penpal/checkout", {
    body: JSON.stringify({
      message: params.message,
      email: params.email,
      recurring: params.recurring === true,
      tier: params.tier,
      custom_amount_cents: params.custom_amount_cents,
    }),
    method: "POST",
  });
}

export async function createSubscriptionCheckout(params: {
  email?: string;
  message?: string;
  username?: string;
  amount?: number;
  success_url?: string;
  cancel_url?: string;
  currency_code?: string;
}): Promise<ApiResponse<CheckoutResponse>> {
  return createCoffeeCheckoutSession({ ...params, recurring: true });
}

export async function createContentUnlockCheckout(params: {
  message_uuid?: string;
  message_id?: number | string;
  success_url?: string;
  cancel_url?: string;
  email?: string;
}): Promise<ApiResponse<CheckoutResponse>> {
  const messageId = Number(params.message_id || params.message_uuid);
  return apiCall("/api/chat/unlock", {
    body: JSON.stringify({ message_id: messageId }),
    method: "POST",
  });
}

export async function getCreatorProfile(): Promise<ApiResponse<AuthCreator>> {
  const session = await apiCall<{
    email: string;
    display_name: string;
    is_creator: boolean;
    user_id: number;
  }>("/api/creator");
  const offer = await apiCall<{
    display_name: string;
    description: string;
    support_item: string;
    avatar_url?: string;
  }>("/api/penpal");
  const userId = session.body?.user_id || 1;
  return ok({
    avatar_url: appMediaUrl(offer.body?.avatar_url),
    bio: offer.body?.description,
    chat_attachment_policy: "creator",
    created_at: new Date().toISOString(),
    email: session.body?.email || "",
    id: userId,
    name: offer.body?.display_name || session.body?.display_name,
    support_theme: offer.body?.support_item,
    user_id: userId,
    username: "creator",
    uuid: "creator",
    variant: "penpal",
  });
}

export async function updateCreatorProfile(params: {
  display_name?: string;
  description?: string;
  support_item?: string;
  one_time_price_cents?: number;
  price_250_cents?: number;
  price_500_cents?: number;
  price_1000_cents?: number;
  weekly_price_cents?: number;
  currency?: string;
}): Promise<ApiResponse<AuthCreator>> {
  await apiCall("/api/creator/settings", {
    body: JSON.stringify(params),
    method: "PATCH",
  });
  return getCreatorProfile();
}

export async function fetchCreatorDashboard(): Promise<
  ApiResponse<ApiDashboardResponse>
> {
  const inbox = await apiCall<{
    conversations: {
      conversation: {
        id: number;
        guest_user_id: number;
        last_activity_at?: { Time?: string } | string;
        created_at?: { Time?: string } | string;
        blocked_at?: { Valid?: boolean; Time?: string } | string | null;
      };
      guest_email: string;
      guest_user_id: number;
      unreplied?: boolean;
      total_paid_cents?: number;
      is_subscriber?: boolean;
      subscription_amount_cents?: number | null;
      last_message?: {
        id: number;
        body: string;
        author_user_id: number;
        created_at?: { Time?: string } | string;
        attachments?: ChatMessageAttachment[];
      };
    }[];
  }>("/api/creator/inbox");
  const chats: ApiCreatorChat[] = (inbox.body?.conversations || []).map(
    (row) => {
      const {id} = row.conversation;
      const last = row.last_message;
      const created = timestamp(row.conversation.created_at);
      const activity = timestamp(row.conversation.last_activity_at) || created;
      return {
        blocked_at: timestamp(row.conversation.blocked_at) || null,
        created_at: created,
        currency_code: "usd",
        fan_avatar_url: null,
        fan_name: row.guest_email,
        fan_user_id: row.guest_user_id,
        id,
        is_active: true,
        is_subscriber: row.is_subscriber === true,
        last_fan_message_content: last?.body ?? null,
        last_message_attachments: sanitizeAttachments(last?.attachments),
        last_message_content: last?.body ?? null,
        last_message_created_at: timestamp(last?.created_at) || null,
        last_message_id: last?.id ?? null,
        last_message_payment_cents: null,
        last_message_product_name: null,
        last_message_sender_id: last?.author_user_id ?? null,
        last_message_uuid: String(id),
        prev_message_content: null,
        prev_message_sender_id: null,
        subscription_amount_cents: row.subscription_amount_cents ?? null,
        total_paid_cents: row.total_paid_cents ?? 0,
        updated_at: activity,
        uuid: String(id),
      };
    }
  );
  return ok({
    active_subscriber_count: chats.filter((c) => c.is_subscriber).length,
    chats,
    earnings_by_currency: [],
    earnings_by_currency_this_month: [],
    grants_by_currency: [],
    mrr_by_currency: [],
    referral_count: 0,
    referral_earnings_by_currency: [],
    stats: {
      pending_replies: chats.filter(
        (c) => c.last_message_sender_id === c.fan_user_id
      ).length,
      penpal_count: chats.length,
      total_earned: 0,
      total_supporters: chats.length,
    },
  });
}

function timestamp(
  value: { Valid?: boolean; Time?: string } | string | null | undefined
): string {
  if (!value) {return "";}
  if (typeof value === "string") {return value;}
  if (value.Valid === false) {return "";}
  return value.Time || "";
}

export async function fetchCreatorPricing(
  _username?: string
): Promise<CreatorPricing> {
  const offer = await apiCall<{
    one_time_price_cents: number;
    price_250_cents?: number;
    price_500_cents?: number;
    price_1000_cents?: number;
    weekly_price_cents: number;
    weekly_allowance_chars: number;
    currency: string;
  }>("/api/penpal");
  const price250 =
    offer.body?.price_250_cents || offer.body?.one_time_price_cents || 500;
  return {
    character_limit: 250,
    currencyCode: offer.body?.currency || "usd",
    price_1000: offer.body?.price_1000_cents || 1500,
    price_250: price250,
    price_500: offer.body?.price_500_cents || 1000,
    weekly_allowance_chars: offer.body?.weekly_allowance_chars,
    weekly_price_cents: offer.body?.weekly_price_cents,
  };
}

export async function requestChatMagicLink(
  _creatorUsername: string,
  email: string
): Promise<ApiResponse<{ message: string }>> {
  return apiCall("/api/penpal/recovery", {
    body: JSON.stringify({ email }),
    method: "POST",
  });
}

export async function consumeChatRecovery(
  token: string
): Promise<ApiResponse<{ token?: string }>> {
  return apiCall("/api/penpal/recovery/consume", {
    body: JSON.stringify({ token }),
    method: "POST",
  });
}

export async function getCheckoutToken(
  sessionId: string
): Promise<ApiResponse<{ token?: string; email?: string }>> {
  return apiCall("/api/penpal/claim", {
    body: JSON.stringify({ session_id: sessionId }),
    method: "POST",
  });
}

export async function getCreatorChatByUsername(
  _username: string,
  _token?: string
): Promise<ApiResponse<CreatorChatResponse>> {
  const res = await apiCall<CreatorChatResponse>("/api/chat");
  if (res.body?.artist) {
    res.body.artist.avatar_url =
      appMediaUrl(res.body.artist.avatar_url) ?? null;
  }
  if (res.body?.messages) {
    res.body.messages = res.body.messages.map((message) => ({
      ...message,
      attachments: message.attachments?.map((attachment) => ({
        ...attachment,
        signed_url: appMediaUrl(attachment.signed_url),
      })),
    }));
  }
  return res;
}

export async function sendChatMessage(
  _chatId: string,
  content: string,
  _token?: string
): Promise<ApiResponse<ChatMessage>> {
  const res = await apiCall<{
    id: number | string;
    body?: string;
    created_at?: string;
  }>("/api/chat/messages", {
    body: JSON.stringify({ body: content }),
    method: "POST",
  });
  const row = res.body;
  return ok({
    amount_cents: null,
    content: row?.body || content,
    created_at: row?.created_at || new Date().toISOString(),
    currency_code: null,
    id: String(row?.id ?? Date.now()),
    sender_type: "fan",
    tier: null,
  });
}

export async function replyToMessage(
  chatId: number | string,
  content: string,
  attachments?: ChatAttachmentRequest[],
  priceInCents?: number,
  _priceCurrencyCode?: string
): Promise<ApiResponse<{ attachments?: ChatMessageAttachment[] }>> {
  const res = await apiCall<{ attachments?: ChatMessageAttachment[] }>(
    `/api/creator/inbox/${chatId}/reply`,
    {
      body: JSON.stringify({
        body: content,
        object_keys: (attachments || []).map((a) => a.url).filter(Boolean),
        unlock_price_cents:
          priceInCents && priceInCents > 0 ? priceInCents : undefined,
      }),
      method: "POST",
    }
  );
  return ok({ attachments: sanitizeAttachments(res.body?.attachments) || [] });
}

export async function fetchChatMessages(
  chatId: number | string
): Promise<ApiResponse<ApiChatMessage[]>> {
  const thread = await apiCall<{
    guest_user_id: number;
    messages?: {
      id: number;
      body: string;
      author_user_id: number;
      created_at?: { Time?: string } | string;
      attachments?: ChatMessageAttachment[];
      unlock_price_cents?: number;
      is_unlocked?: boolean;
    }[];
  }>(`/api/creator/inbox/${chatId}`);
  const guestId = thread.body?.guest_user_id;
  return ok(
    (thread.body?.messages || []).map((m) => ({
      amount_cents: m.unlock_price_cents ?? null,
      attachments: sanitizeAttachments(m.attachments),
      content: m.body,
      created_at: timestamp(m.created_at),
      currency_code: m.unlock_price_cents ? "usd" : null,
      id: String(m.id),
      is_creator: guestId != null && m.author_user_id !== guestId,
      sender_id: m.author_user_id,
      sender_name: null,
      tier: null,
    }))
  );
}

export async function uploadCreatorMedia(
  file: File
): Promise<
  ApiResponse<{
    object_key: string;
    type: string;
    filename: string;
    size: number;
  }>
> {
  const body = new FormData();
  body.append("file", file);
  return apiCall("/api/creator/media", { body, method: "POST" });
}

export async function uploadCreatorAvatar(
  file: File
): Promise<ApiResponse<{ object_key: string }>> {
  const body = new FormData();
  body.append("file", file);
  return apiCall("/api/creator/avatar", { body, method: "POST" });
}

export async function createManageSubscriptionURL(
  _subscriptionUuid?: string,
  _token?: string
): Promise<ApiResponse<{ url?: string }>> {
  return ok();
}

export function setChatAuthToken(_token: string, _creator: string) {}

/** Guest chat uses the HTTP-only session cookie, not a browser JWT. */
export function getChatAuthToken(_creator: string): string | null {
  return "cookie";
}

export function clearChatAuthToken(_creator: string) {}

export async function blockChat(chatUuid: string): Promise<ApiResponse> {
  return apiCall(`/api/creator/inbox/${chatUuid}/block`, { method: "POST" });
}

export async function unblockChat(chatUuid: string): Promise<ApiResponse> {
  return apiCall(`/api/creator/inbox/${chatUuid}/unblock`, { method: "POST" });
}

export async function getCommunityNotesByPromptV2(
  promptUuid: string
): Promise<ApiResponse<CommunityNotesV2Response>> {
  return apiCall(`/api/dome/prompts/${encodeURIComponent(promptUuid)}/notes`);
}

export async function getCommunityNotesByUser(
  promptUuid: string
): Promise<ApiResponse<CommunityNote[]>> {
  return apiCall(
    `/api/dome/prompts/${encodeURIComponent(promptUuid)}/notes?mine=1`
  );
}

export async function createCommunityNote(params: {
  community_uuid?: string;
  prompt_uuid?: string;
  author_name?: string;
  content: string;
  emoji?: string;
  shape?: string;
  color?: string;
  is_anonymous?: boolean;
  parent_uuid?: string;
}): Promise<ApiResponse<CommunityNote>> {
  return apiCall("/api/dome/notes", {
    body: JSON.stringify({
      prompt_uuid: params.prompt_uuid,
      content: params.content,
      emoji: params.emoji,
      shape: params.shape,
      color: params.color,
      is_anonymous: params.is_anonymous === true,
      parent_uuid: params.parent_uuid,
    }),
    method: "POST",
  });
}

export async function createCommunityPrompt(params: {
  community_uuid?: string;
  content: string;
}): Promise<ApiResponse<CommunityPrompt>> {
  const res = await apiCall<{ prompt: CommunityPrompt }>("/api/dome/prompts", {
    body: JSON.stringify({ content: params.content }),
    method: "POST",
  });
  return { body: res.body?.prompt, status: res.status };
}

export async function getCommunityByCreator(
  _uuid: string
): Promise<ApiResponse<Community | null>> {
  const res = await apiCall<{ community: Community | null }>("/api/dome");
  return { body: res.body?.community ?? null, status: res.status };
}

export async function getCommunityPromptsWithNoteCount(
  _uuid: string
): Promise<ApiResponse<CommunityPromptWithNoteCount[]>> {
  return apiCall("/api/dome/prompts");
}

export async function getCommunityMembers(
  _uuid: string
): Promise<ApiResponse<CommunityMember[]>> {
  return apiCall("/api/dome/members");
}

export async function createCommunity(params: {
  title?: string;
  first_prompt: string;
}): Promise<ApiResponse<{ community: Community; prompt: CommunityPrompt }>> {
  return apiCall("/api/dome/prompts", {
    body: JSON.stringify({
      first_prompt: params.first_prompt,
      content: params.first_prompt,
    }),
    method: "POST",
  });
}
