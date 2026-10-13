// Wire contract for the browser → ledger ingest at /api/telemetry/client.
// Deliberately loose: a crash report is untrusted input, so every field is
// short-capped here and clipped again before it reaches the table.
import { z } from 'zod';

export const ClientErrorReport = z.object({
  message: z.string().trim().min(1).max(600),
  stack: z.string().max(8000).optional(),
  digest: z.string().max(200).optional(),
  url: z.string().max(500).optional(),
  componentStack: z.string().max(8000).optional(),
});

export const ClientErrorAck = z.object({ ok: z.literal(true) });

export type ClientErrorReport = z.infer<typeof ClientErrorReport>;
export type ClientErrorAck = z.infer<typeof ClientErrorAck>;
