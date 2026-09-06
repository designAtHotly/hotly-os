"use client";

import { useState, useEffect } from "react";
import { CreatorPricing, SupportTheme, capitalize, getThemeEmoji } from "@/types/coffee.types";
import { updateCreatorProfile } from "@/lib/api/creator";
import { uploadCreatorAvatar } from "@/lib/api/oss";
import { captureError } from "@/lib/utils/error-handler";
import { toastError, toastSuccess } from "@/lib/utils/toast";

const THEMES: SupportTheme[] = ["coffee", "cocktail", "lemonade"];

interface SettingsSave {
  displayName: string;
  description: string;
  supportTheme: SupportTheme;
  pricing: CreatorPricing;
}

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  displayName: string;
  description: string;
  supportTheme: SupportTheme;
  pricing: CreatorPricing;
  onSaved: (updates: SettingsSave) => void;
}

export default function SettingsModal({
  isOpen,
  onClose,
  displayName,
  description,
  supportTheme,
  pricing,
  onSaved,
}: SettingsModalProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(displayName);
  const [bio, setBio] = useState(description);
  const [selectedTheme, setSelectedTheme] = useState<SupportTheme>(supportTheme);
  const [oneTime, setOneTime] = useState("");
  const [weekly, setWeekly] = useState("");
  const [charLimit, setCharLimit] = useState("");

  useEffect(() => {
    if (isOpen) {
      setName(displayName);
      setBio(description);
      setSelectedTheme(supportTheme);
      setOneTime(((pricing.price_250 || 0) / 100).toString());
      setWeekly(((pricing.weekly_price_cents || 0) / 100).toString());
      setCharLimit(String(pricing.character_limit || 250));
      requestAnimationFrame(() => setIsVisible(true));
    } else {
      setIsVisible(false);
    }
  }, [isOpen, displayName, description, supportTheme, pricing]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !saving) {
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, saving, onClose]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !saving) onClose();
  };

  const handleSave = async () => {
    const oneTimeCents = Math.round(parseFloat(oneTime) * 100);
    const weeklyCents = Math.round(parseFloat(weekly) * 100);
    const limit = parseInt(charLimit, 10);
    if (!name.trim() || !oneTimeCents || !weeklyCents || oneTimeCents <= 0 || weeklyCents <= 0 || !limit || limit <= 0) {
      toastError("Enter a name and positive USD prices.");
      return;
    }

    setSaving(true);
    try {
      const result = await updateCreatorProfile({
        display_name: name.trim(),
        description: bio.trim(),
        support_item: selectedTheme,
        one_time_price_cents: oneTimeCents,
        one_time_character_limit: limit,
        weekly_price_cents: weeklyCents,
        currency: "usd",
      });

      if (result.status && result.status >= 400) {
        toastError("Failed to update");
        return;
      }

      onSaved({
        displayName: name.trim(),
        description: bio.trim(),
        supportTheme: selectedTheme,
        pricing: {
          currencyCode: "usd",
          price_250: oneTimeCents,
          price_500: oneTimeCents,
          price_1000: oneTimeCents,
          character_limit: limit,
          weekly_price_cents: weeklyCents,
          weekly_allowance_chars: 2000,
        },
      });
      toastSuccess("Updated");
      onClose();
    } catch (err) {
      captureError(err, { action: "save_settings", component: "SettingsModal" });
      toastError("Failed to update");
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-5 transition-all duration-250 ${
        isVisible ? "bg-black/30 backdrop-blur-[4px]" : "bg-transparent"
      }`}
      onClick={handleBackdropClick}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        className={`w-full max-w-[420px] bg-white rounded-[24px] overflow-hidden relative max-h-[90dvh] overflow-y-auto transition-all duration-250 ${
          isVisible ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 translate-y-5"
        }`}
        style={{ boxShadow: "0 20px 60px rgba(0, 0, 0, 0.15)" }}
      >
        <button
          type="button"
          onClick={onClose}
          disabled={saving}
          aria-label="Close settings"
          className="absolute top-4 right-4 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-stone-100 text-stone-400 transition-colors hover:bg-stone-200 hover:text-stone-600 disabled:opacity-50"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M1 1l12 12M13 1L1 13" />
          </svg>
        </button>

        <div className="px-6 pt-6 pb-4">
          <h2 id="settings-title" className="text-lg font-semibold text-stone-900">Settings</h2>
          <p className="mt-0.5 text-sm text-stone-500">Name, description, USD prices, and support item</p>
        </div>

        <div className="space-y-5 px-6 pb-5">
          <div>
            <label htmlFor="settings-name" className="mb-2 block text-sm font-medium text-stone-700">
              Display name
            </label>
            <input
              id="settings-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-800 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>

          <div>
            <label htmlFor="settings-avatar" className="mb-2 block text-sm font-medium text-stone-700">
              Photo
            </label>
            <input
              id="settings-avatar"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              disabled={saving}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                if (file.size > 3 * 1024 * 1024) {
                  toastError("Photos must be 3MB or smaller.");
                  return;
                }
                try {
                  await uploadCreatorAvatar(file);
                  toastSuccess("Photo updated");
                } catch (err) {
                  captureError(err, { action: "upload_avatar", component: "SettingsModal" });
                  toastError("Could not update photo.");
                }
              }}
              className="block w-full text-sm text-stone-600 file:mr-3 file:rounded-lg file:border-0 file:bg-amber-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-amber-800"
            />
            <p className="mt-1 text-xs text-stone-400">JPEG, PNG, WebP, or GIF. 3MB max.</p>
          </div>

          <div>
            <label htmlFor="settings-bio" className="mb-2 block text-sm font-medium text-stone-700">
              Description
            </label>
            <textarea
              id="settings-bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={2000}
              rows={3}
              className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-800 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-stone-700">Support item</p>
            <div className="grid grid-cols-3 gap-1.5">
              {THEMES.map((theme) => (
                <button
                  type="button"
                  key={theme}
                  onClick={() => setSelectedTheme(theme)}
                  className={`flex flex-col items-center gap-1 rounded-xl py-2.5 text-xs font-medium transition-all ${
                    selectedTheme === theme
                      ? "bg-amber-100 text-amber-800 ring-2 ring-amber-400"
                      : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                  }`}
                >
                  <span className="text-base">{getThemeEmoji(theme)}</span>
                  {capitalize(theme)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-stone-700">USD prices</p>
            <div className="space-y-2">
              <label className="flex items-center gap-3">
                <span className="w-32 shrink-0 text-xs text-stone-500">One-time note</span>
                <span className="text-sm text-stone-400">$</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={oneTime}
                  onChange={(e) => {
                    if (e.target.value === "" || /^\d+\.?\d{0,2}$/.test(e.target.value)) setOneTime(e.target.value);
                  }}
                  className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </label>
              <label className="flex items-center gap-3">
                <span className="w-32 shrink-0 text-xs text-stone-500">Weekly Penpal</span>
                <span className="text-sm text-stone-400">$</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={weekly}
                  onChange={(e) => {
                    if (e.target.value === "" || /^\d+\.?\d{0,2}$/.test(e.target.value)) setWeekly(e.target.value);
                  }}
                  className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </label>
              <label className="flex items-center gap-3">
                <span className="w-32 shrink-0 text-xs text-stone-500">Note character limit</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={charLimit}
                  onChange={(e) => {
                    if (e.target.value === "" || /^\d+$/.test(e.target.value)) setCharLimit(e.target.value);
                  }}
                  className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </label>
            </div>
          </div>
        </div>

        <div className="border-t border-[#f0ebe3] bg-[#fdfbf8] px-6 py-4">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="w-full rounded-2xl py-3 text-[15px] font-semibold text-white transition-all duration-150 hover:-translate-y-0.5 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:transform-none"
            style={{
              background: "linear-gradient(145deg, #fbbf24, #f59e0b)",
              boxShadow: "0 2px 12px rgba(245, 158, 11, 0.2)",
            }}
          >
            {saving ? (
              <div className="mx-auto h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              "Save changes"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
