"use client";

interface DomeOnboardingProps {
  onClose: () => void;
  source?: string;
  referralUsername?: string;
}

export default function DomeOnboarding({ onClose }: DomeOnboardingProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center">
        <p className="mb-4 text-sm text-gray-600">
          This instance is for a single creator. Member posting opens in a later slice.
        </p>
        <button
          type="button"
          className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white"
          onClick={onClose}
        >
          Close
        </button>
      </div>
    </div>
  );
}
