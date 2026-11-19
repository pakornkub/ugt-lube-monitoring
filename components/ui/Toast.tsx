'use client';

import type { ReactNode } from 'react';
import { toast } from 'sonner';

// The app's toast API, now rendered by the kit's sonner <Toaster richColors /> (app/layout.tsx).
// Call sites keep `const toast = useToast(); toast(msg, type)`.
type ToastType = 'success' | 'error' | 'warning' | 'info';

function show(msg: string, type: ToastType = 'success') {
  toast[type](msg);
}

export function useToast() {
  return show;
}

/** Kept for existing imports; the Toaster lives in the root layout. */
export function ToastProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
