"use client";

import { TabOption, SortOption } from "@/types/dashboard.types";

interface TabsBarProps {
  activeTab: TabOption;
  sortBy: SortOption;
  needsReplyCount: number;
  blockedCount: number;
  blockedUnrepliedCount: number;
  showSortDropdown: boolean;
  onTabChange: (tab: TabOption) => void;
  onSortChange: (sort: SortOption) => void;
  onToggleSortDropdown: () => void;
  onCloseSortDropdown: () => void;
  variant?: string;
}

const getSortOptions = (variant: string) => [
  { value: "oldest", label: "Longest waiting" },
  { value: "newest", label: "Most recent" },
  { value: "highest-tip", label: "Highest tip" },
  { value: "lowest-tip", label: "Lowest tip" },
  { value: "most-given", label: "Top supporters" },
  { value: "least-given", label: "Newest supporters" },
  { value: "penpals-first", label: `${variant} first` },
] as const;

export function TabsBar({
  activeTab,
  sortBy,
  needsReplyCount,
  blockedCount,
  blockedUnrepliedCount,
  showSortDropdown,
  onTabChange,
  onSortChange,
  onToggleSortDropdown,
  onCloseSortDropdown,
  variant = "Penpals",
}: TabsBarProps) {
  return (
    <div className="flex items-center justify-between mb-4">
      {/* Tab Buttons */}
      <div className="flex gap-2">
        {(["needs-reply", "all", "blocked"] as const).map(tab => (
          <button
            key={tab}
            onClick={() => onTabChange(tab)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
              activeTab === tab
                ? tab === "blocked"
                  ? "bg-red-50 text-red-600 border-2 border-red-300"
                  : "bg-amber-100 text-amber-700 border-2 border-amber-400"
                : "bg-white text-gray-500 border-2 border-transparent hover:bg-gray-50"
            }`}
          >
            {tab === "needs-reply" ? "Needs reply" : tab === "all" ? "All" : "Blocked"}
            {tab === "needs-reply" && needsReplyCount > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 bg-amber-500 text-white rounded-full text-xs">
                {needsReplyCount}
              </span>
            )}
            {tab === "blocked" && blockedCount > 0 && (
              <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-xs ${
                blockedUnrepliedCount > 0
                  ? "bg-red-100 text-red-500 border border-red-300"
                  : "bg-gray-300 text-gray-600"
              }`}>
                {blockedCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Sort Dropdown — hidden on blocked tab */}
      <div className="relative">
        <button
          onClick={onToggleSortDropdown}
          style={{ visibility: activeTab === "blocked" ? "hidden" : undefined }}
          className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-500 hover:text-gray-700"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
          </svg>
        </button>

        {showSortDropdown && (
          <>
            <div className="fixed inset-0 z-10" onClick={onCloseSortDropdown} />
            <div className="absolute right-0 mt-1 w-44 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-20">
              {getSortOptions(variant).map(opt => (
                <button
                  key={opt.value}
                  onClick={() => {
                    onSortChange(opt.value as SortOption);
                    onCloseSortDropdown();
                  }}
                  className={`w-full px-4 py-2 text-left text-sm ${
                    sortBy === opt.value
                      ? "bg-amber-50 text-amber-700 font-medium"
                      : "text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
