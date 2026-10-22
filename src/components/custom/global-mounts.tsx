// the agent OWNS this file (edit freely).
// Writable home for root/global UI (Cmd+K palette, global keyboard listeners,
// app-wide overlays/dialogs), mounted once at the app root by layout.tsx.
// Put root mounts here, NOT in framework-owned layout.tsx.

'use client';

import { usePathname } from 'next/navigation';
import { AssistiveTouch } from '@/components/custom/assistive-touch';
import { PwaRegister } from '@/components/custom/pwa-register';

export function GlobalMounts() {
  const pathname = usePathname();
  const focusedApp =
    pathname === '/courier' ||
    pathname.startsWith('/courier/') ||
    pathname === '/track' ||
    pathname.startsWith('/track/');

  return (
    <>
      <PwaRegister />
      {focusedApp ? null : <AssistiveTouch />}
    </>
  );
}
