'use client';

import { useState } from 'react';

type TabId = 'quick-play' | 'lobby';

interface MainTabsProps {
  quickPlayContent: React.ReactNode;
  lobbyContent: React.ReactNode;
}

const TABS: { id: TabId; label: string }[] = [
  { id: 'quick-play', label: 'QUICK PLAY' },
  { id: 'lobby', label: 'LOBBY' },
];

export default function MainTabs({ quickPlayContent, lobbyContent }: MainTabsProps) {
  const [activeTab, setActiveTab] = useState<TabId>('quick-play');

  return (
    <div className="flex flex-col gap-4">
      {/* Tab bar */}
      <div className="flex border-b border-[var(--border)]">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-2.5 text-sm font-semibold tracking-wide transition-colors relative ${
              activeTab === tab.id
                ? 'text-[var(--accent)]'
                : 'text-[var(--muted)] hover:text-[var(--foreground)]'
            }`}
          >
            {tab.label}
            {activeTab === tab.id && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--accent)]" />
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'quick-play' ? quickPlayContent : lobbyContent}
    </div>
  );
}
