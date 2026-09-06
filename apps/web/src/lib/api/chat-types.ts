export interface CreatorChatResponse {
  chat: {
    id: string;
    uuid: string;
    created_at: string;
  };
  artist: {
    id: string;
    name: string;
    slug: string;
    avatar_url: string | null;
    response_promise: string;
    chat_attachment_policy: string;
  };
  fan: {
    email: string;
    name: string | null;
  };
  messages: ChatMessage[];
  subscription: {
    status: "none" | "active" | "cancelled";
    tier: string | null;
    amount_in_cents: number | null;
    currency_code: string | null;
    current_period_start: string | null;
    current_period_end: string | null;
    paused_until: string | null;
    subscription_uuid: string | null;
  };
}

export interface ChatMessage {
  id: string;
  sender_type: "fan" | "artist";
  content: string;
  tier: string | null;
  amount_cents: number | null;
  currency_code: string | null;
  is_unlocked?: boolean;
  price_in_cents?: number | null;
  price_currency_code?: string | null;
  attachments?: { signed_url?: string; filename: string; size: number; type: string }[];
  created_at: string;
}
