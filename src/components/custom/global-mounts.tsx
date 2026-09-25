// the agent OWNS this file (edit freely).
// Writable home for root/global UI (Cmd+K palette, global keyboard listeners,
// app-wide overlays/dialogs), mounted once at the app root by layout.tsx.
// Put root mounts here, NOT in framework-owned layout.tsx.

'use client';

import { AssistiveTouch } from '@/components/custom/assistive-touch';

export function GlobalMounts() {
  return <AssistiveTouch />;
}
