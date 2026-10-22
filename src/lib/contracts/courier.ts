// Client-safe contracts for courier onboarding, dispatch and the courier app.
import { z } from 'zod';

export const CourierVehicleType = z.enum(['MOTORBIKE', 'TRICYCLE', 'CAR', 'BICYCLE', 'WALKING']);
export type CourierVehicleTypeValue = z.infer<typeof CourierVehicleType>;

export const CourierMembershipStatus = z.enum(['PENDING', 'ACTIVE', 'SUSPENDED']);

export const CourierJoinInput = z.object({
  name: z.string().trim().min(2, 'Tell us your full name').max(100, 'That name is too long'),
  phone: z
    .string()
    .trim()
    .min(1, 'A phone number is needed')
    .max(40, 'Phone is too long')
    .refine((value) => value.replace(/\D/g, '').length >= 9, 'That phone number looks too short'),
  vehicleType: CourierVehicleType.default('MOTORBIKE'),
  plateNumber: z.string().trim().max(24, 'Keep the plate short').optional(),
});

export const CourierInviteInfo = z.object({
  storeName: z.string(),
  storeSlug: z.string(),
  storePhone: z.string().nullable(),
  expiresAt: z.string().datetime(),
});

export const CourierJoinResult = z.object({
  ok: z.literal(true),
  storeName: z.string(),
  status: CourierMembershipStatus,
});

export const CourierMembershipSummary = z.object({
  storeId: z.string(),
  storeName: z.string(),
  storeSlug: z.string(),
  status: CourierMembershipStatus,
});

export const CourierMe = z.object({
  id: z.string(),
  name: z.string(),
  phone: z.string(),
  vehicleType: CourierVehicleType,
  plateNumber: z.string().nullable(),
  isOnline: z.boolean(),
  lastLocationAt: z.string().datetime().nullable(),
  memberships: z.array(CourierMembershipSummary),
});

export const CourierLocationInput = z.object({
  lat: z.number().finite().min(-90).max(90),
  lng: z.number().finite().min(-180).max(180),
  accuracy: z.number().finite().nonnegative().max(100_000).optional(),
  isOnline: z.boolean().default(true),
});

export const CourierPresenceInput = z.object({
  isOnline: z.boolean(),
});

export const CourierJobStatusInput = z.object({
  status: z.enum(['IN_TRANSIT', 'DELIVERED']),
  note: z.string().trim().max(300).optional(),
});

export const CourierJob = z.object({
  orderId: z.string(),
  orderNumber: z.string(),
  description: z.string(),
  storeName: z.string(),
  storeAddress: z.string().nullable(),
  storePhone: z.string().nullable(),
  storeLat: z.number(),
  storeLng: z.number(),
  customerName: z.string().nullable(),
  customerPhone: z.string().nullable(),
  customerLat: z.number().nullable(),
  customerLng: z.number().nullable(),
  deliveryFeePesewas: z.number().int().nonnegative(),
  deliveryStatus: z.enum(['PENDING_DISPATCH', 'RIDER_ASSIGNED', 'IN_TRANSIT', 'DELIVERED']),
  handoffCode: z.string().nullable(),
  offeredAt: z.string().datetime().nullable(),
  acceptedAt: z.string().datetime().nullable(),
  distanceKm: z.number().nullable(),
});

export const CourierJobs = z.object({
  offers: z.array(CourierJob),
  active: z.array(CourierJob),
});

export const CourierAcceptResult = z.object({
  ok: z.literal(true),
  orderId: z.string(),
  deliveryStatus: z.enum(['RIDER_ASSIGNED', 'IN_TRANSIT', 'DELIVERED']),
});

export const CourierStatusResult = z.object({
  ok: z.literal(true),
  deliveryStatus: z.enum(['IN_TRANSIT', 'DELIVERED']),
});

export const CrewMember = z.object({
  membershipId: z.string(),
  courierId: z.string(),
  name: z.string(),
  phone: z.string(),
  vehicleType: CourierVehicleType,
  plateNumber: z.string().nullable(),
  status: CourierMembershipStatus,
  isOnline: z.boolean(),
  lastLocationAt: z.string().datetime().nullable(),
  joinedAt: z.string().datetime(),
  deliveries: z.number().int().nonnegative(),
});

export const CrewOverview = z.object({
  storeId: z.string(),
  storeName: z.string(),
  autoDispatch: z.boolean(),
  dispatchRadiusKm: z.number(),
  inviteUrl: z.string().url().nullable(),
  inviteExpiresAt: z.string().datetime().nullable(),
  pendingCount: z.number().int().nonnegative(),
  onlineCount: z.number().int().nonnegative(),
  members: z.array(CrewMember),
});

export const CrewInviteResult = z.object({
  url: z.string().url(),
  expiresAt: z.string().datetime(),
});

export const CrewMemberUpdate = z.object({
  status: z.enum(['ACTIVE', 'SUSPENDED']),
});

export const DispatchSettingsUpdate = z.object({
  autoDispatch: z.boolean().optional(),
  dispatchRadiusKm: z.number().finite().min(1).max(50).optional(),
});

export const DispatchInput = z.object({
  radiusKm: z.number().finite().min(1).max(50).optional(),
});

export const DispatchResult = z.object({
  ok: z.literal(true),
  offers: z.number().int().nonnegative(),
  onlineCouriers: z.number().int().nonnegative(),
  radiusKm: z.number(),
  handoffCode: z.string().length(6),
});

export const DeliveryEventItem = z.object({
  id: z.string(),
  type: z.string(),
  actorType: z.string(),
  actorId: z.string().nullable(),
  note: z.string().nullable(),
  createdAt: z.string().datetime(),
});

export const MerchantDelivery = z.object({
  orderId: z.string(),
  orderNumber: z.string(),
  deliveryStatus: z.enum([
    'NOT_APPLICABLE',
    'PENDING_DISPATCH',
    'RIDER_ASSIGNED',
    'IN_TRANSIT',
    'DELIVERED',
  ]),
  courierName: z.string().nullable(),
  courierPhone: z.string().nullable(),
  handoffCode: z.string().nullable(),
  handoffCodeUsedAt: z.string().datetime().nullable(),
  buyerConfirmedAt: z.string().datetime().nullable(),
  merchantVerifiedAt: z.string().datetime().nullable(),
  deliveredAt: z.string().datetime().nullable(),
  events: z.array(DeliveryEventItem),
  proofUrl: z.string().nullable(),
  proofConsent: z.boolean(),
});

export const MerchantVerifyInput = z.object({
  note: z.string().trim().max(300).optional(),
});

export const CrewDeliveryList = z.object({
  items: z.array(MerchantDelivery),
});

export const PublicOrderCourier = z.object({
  name: z.string(),
  phone: z.string().nullable(),
  vehicleType: z.string(),
  plateNumber: z.string().nullable(),
  lat: z.number().nullable(),
  lng: z.number().nullable(),
  lastSeenAt: z.string().datetime().nullable(),
});

export type CourierJoinInput = z.infer<typeof CourierJoinInput>;
export type CourierInviteInfo = z.infer<typeof CourierInviteInfo>;
export type CourierMe = z.infer<typeof CourierMe>;
export type CourierJob = z.infer<typeof CourierJob>;
export type CourierJobs = z.infer<typeof CourierJobs>;
export type CrewOverview = z.infer<typeof CrewOverview>;
export type CrewMember = z.infer<typeof CrewMember>;
export type DispatchResult = z.infer<typeof DispatchResult>;
export type MerchantDelivery = z.infer<typeof MerchantDelivery>;
export type CrewDeliveryList = z.infer<typeof CrewDeliveryList>;
