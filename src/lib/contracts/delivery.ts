// Client-safe contracts for the public rider gig link. The rider has no
// account: they identify themselves with a phone/name string that is stored on
// the order as riderId, then the response hands off to native maps navigation.
import { z } from 'zod';
import { DeliveryStatus } from '@/lib/contracts/order';

export const DeliveryAccept = z.object({
  riderId: z
    .string()
    .trim()
    .min(3, 'Enter your name or phone number')
    .max(80, 'That rider name is too long'),
});

// Public payload for one rider gig. Coordinates are intentionally included:
// the rider needs them to navigate, and the order number is the unguessable
// capability in the shared link.
export const RiderJobResult = z.object({
  orderNumber: z.string(),
  description: z.string(),
  deliveryStatus: DeliveryStatus,
  deliveryFeePesewas: z.number().int().nonnegative(),
  riderId: z.string().nullable(),
  store: z.object({
    name: z.string(),
    address: z.string().nullable(),
    lat: z.number(),
    lng: z.number(),
  }),
  customer: z.object({
    lat: z.number(),
    lng: z.number(),
  }),
});

export const DeliveryAcceptResult = z.object({
  ok: z.literal(true),
  deliveryStatus: DeliveryStatus,
  riderId: z.string(),
  directionsUrl: z.string(),
});

export type DeliveryAcceptInput = z.infer<typeof DeliveryAccept>;
export type DeliveryAcceptResultValue = z.infer<typeof DeliveryAcceptResult>;
export type RiderJob = z.infer<typeof RiderJobResult>;
