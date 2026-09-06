export type FanState = "pay_per_message" | "unlimited";

export type SubscriptionStatus = "none" | "active" | "paused" | "cancelled";

export interface MessageAttachment {
  signed_url?: string; // Missing when message is locked (unlocked === false)
  signed_thumbnail_url?: string | null;
  filename: string;
  size: number;
  type: string; // 'image', 'video', 'audio', 'file'
}

export interface Message {
  id: string;
  sender_type: "fan" | "artist";
  content: string;
  tier: string | null; // For fan messages: which tier they paid
  amount_cents: number | null; // For fan messages: what they paid
  currency_code: string | null; // For fan messages: currency of payment
  is_unlocked?: boolean; // false when paid content hasn't been purchased
  price_in_cents?: number | null; // Price set by creator for this message
  price_currency_code?: string | null;
  attachments?: MessageAttachment[];
  created_at: string;
}
