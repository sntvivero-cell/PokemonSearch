'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';

interface ToastProps {
  message: string;
  // Sin duration/onDismiss el toast queda montado a criterio del padre (caso actual de
  // publicar/editar, que navega antes de que importe) — solo se anima la entrada.
  duration?: number;
  onDismiss?: () => void;
}

const EXIT_ANIMATION_MS = 200;

export function Toast({ message, duration, onDismiss }: ToastProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const enter = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(enter);
  }, []);

  useEffect(() => {
    if (!duration) return;

    const hideTimer = setTimeout(() => setVisible(false), duration);
    return () => clearTimeout(hideTimer);
  }, [duration]);

  useEffect(() => {
    if (!duration || visible) return;

    const dismissTimer = setTimeout(() => onDismiss?.(), EXIT_ANIMATION_MS);
    return () => clearTimeout(dismissTimer);
  }, [visible, duration, onDismiss]);

  return (
    <div
      className={`fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-full border border-[#2E9BF5]/40
                  bg-[#131A22] px-4 py-2.5 text-xs font-semibold text-[#2E9BF5] shadow-lg backdrop-blur-sm
                  transition-all duration-200 ease-out
                  ${visible ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'}`}
    >
      <span className="flex items-center gap-1.5">
        <CheckCircle2 className="h-3.5 w-3.5" />
        {message}
      </span>
    </div>
  );
}
