'use client';

import type { FeedTab } from '@/app/types/trades';

interface FeedTabsProps {
  active: FeedTab;
  onChange: (tab: FeedTab) => void;
  counts: Record<FeedTab, number>;
}

const TABS: { key: FeedTab; label: string }[] = [
  { key: 'all', label: 'Feed global' },
  { key: 'for_trade', label: 'Ofrecen' },
  { key: 'looking_for', label: 'Buscan' },
];

export function FeedTabs({ active, onChange, counts }: FeedTabsProps) {
  return (
    <div className="inline-flex rounded-full border border-[#232D38] bg-[#131A22] p-1">
      {TABS.map(({ key, label }) => {
        const isActive = active === key;
        return (
          <button
            key={key}
            onClick={() => onChange(key)}
            className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold transition-all ${
              isActive
                ? 'bg-[#2E9BF5] text-white shadow-[0_0_12px_-2px_rgba(46,155,245,0.6)]'
                : 'text-[#8792A0] hover:text-[#F4F6F8]'
            }`}
          >
            {label}
            <span
              className={`rounded-full px-1.5 text-[10px] ${
                isActive ? 'bg-white/20' : 'bg-[#232D38] text-[#5C6773]'
              }`}
            >
              {counts[key]}
            </span>
          </button>
        );
      })}
    </div>
  );
}
