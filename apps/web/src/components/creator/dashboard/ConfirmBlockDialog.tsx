"use client";

import { useState, useEffect } from "react";
import { ShieldBan } from "lucide-react";

interface ConfirmBlockDialogProps {
  isOpen: boolean;
  fanName: string;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}

export function ConfirmBlockDialog({
  isOpen,
  fanName,
  onCancel,
  onConfirm,
}: ConfirmBlockDialogProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [blocking, setBlocking] = useState(false);

  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => setIsVisible(true));
    } else {
      setIsVisible(false);
      setBlocking(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !blocking) {
        onCancel();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, blocking, onCancel]);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    if (blocking) return;
    setBlocking(true);
    try {
      await onConfirm();
    } finally {
      setBlocking(false);
    }
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-5 transition-all duration-200 ${isVisible ? "bg-black/30 backdrop-blur-[4px]" : "bg-transparent"}`}
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="block-dialog-title"
        className={`w-full max-w-[340px] bg-[#FAF6F0] rounded-2xl overflow-hidden shadow-xl transition-all duration-200 ${isVisible ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 translate-y-3"}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 pt-5 pb-4 text-center">
          <div className="mx-auto w-10 h-10 rounded-full bg-[#A85A5A]/10 flex items-center justify-center mb-3">
            <ShieldBan className="w-5 h-5 text-[#A85A5A]" />
          </div>
          <h3 id="block-dialog-title" className="text-base font-semibold text-[#2A2318]">Block this fan?</h3>
          <p className="text-sm text-[#8A7E6E] mt-1">
            You will no longer receive notifications for messages from {fanName}.
          </p>
        </div>

        <div className="flex gap-3 px-5 pb-5">
          <button
            type="button"
            onClick={onCancel}
            disabled={blocking}
            className="flex-1 py-2.5 border border-[#D4C8B0]/20 text-[#5A4D3A] rounded-lg text-sm font-medium hover:bg-[#F5EFE5]/50 transition-colors disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={blocking}
            className="flex-1 py-2.5 bg-[#A85A5A] text-white rounded-lg text-sm font-medium hover:bg-[#A85A5A]/70 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {blocking ? "Blocking..." : "Block"}
          </button>
        </div>
      </div>
    </div>
  );
}
