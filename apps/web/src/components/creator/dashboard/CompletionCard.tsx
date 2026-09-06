"use client";

interface CompletionCardProps {
  repliedCount: number;
}

export function CompletionCard({ repliedCount }: CompletionCardProps) {
  return (
    <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-8 text-center">
      <span className="text-5xl block mb-4">🎉</span>
      <p className="text-xl font-bold text-gray-900 mb-2">You crushed it!</p>
      <p className="text-amber-700">
        {repliedCount} conversation{repliedCount !== 1 ? "s" : ""} replied
      </p>
    </div>
  );
}
