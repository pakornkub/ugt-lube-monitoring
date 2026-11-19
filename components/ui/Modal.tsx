'use client';

import type { ReactNode } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';

// The app's modal API on the kit's Dialog (Base UI: focus trap, Escape, focus return,
// aria-modal are the primitive's job now). Look kept: bg-bg3 surface, 18px bold title.
export function Modal({
  open,
  onClose,
  title,
  children,
  maxWidth = 450,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  maxWidth?: number;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        className="block max-h-[82vh] w-[90%] overflow-y-auto rounded-xl border border-border bg-bg3 p-5 text-[14px] text-t1 sm:max-w-none"
        style={{ maxWidth }}
      >
        <DialogTitle className="mb-3 pr-8 font-sans text-[18px] font-bold text-t1 max-sm:text-[16px]">
          {title}
        </DialogTitle>
        {children}
      </DialogContent>
    </Dialog>
  );
}
