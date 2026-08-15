'use client';

import { CheckCircle2 } from 'lucide-react';

interface ToastProps {
  message: string;
}

export function Toast({ message }: ToastProps) {
  return (
    <div
      className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-full border border-[#2E9BF5]/40
                 bg-[#131A22] px-4 py-2.5 text-xs font-semibold text-[#2E9BF5] shadow-lg backdrop-blur-sm"
    >
      <span className="flex items-center gap-1.5">
        <CheckCircle2 className="h-3.5 w-3.5" />
        {message}
      </span>
    </div>
  );
}
