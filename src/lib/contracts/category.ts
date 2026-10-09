// Client-safe product-category contracts shared by the manager routes, the
// dashboard islands and the public storefront.
//
// A category is a shelf heading inside ONE store's catalogue ("Beads", "Wall
// art", "Custom orders"). It has no userId of its own — like StoreItem,
// Promotion and StorePost it is reached through its store, so a guessed cuid
// cannot resolve against another shop (see FEATURES.md §1). Every route that
// touches one resolves the store through requireAuth first.
import { z } from 'zod';

export const CategoryCreate = z.object({
  name: z.string().trim().min(1, 'Give the category a name').max(40, 'Name is too long'),
  sortOrder: z.number().int().nonnegative().default(0),
  active: z.boolean().default(true),
  // Shelf icon key (see src/lib/category-icons.ts allowlist). Null = no icon.
  icon: z.string().trim().max(40).nullable().optional(),
});

// PATCH body: any subset of mutable fields. Built by hand (NOT
// CategoryCreate.partial()) so absent keys stay `undefined` — .partial() keeps
// the .default()s, which would silently re-activate a hidden category on a
// name-only edit.
export const CategoryUpdate = z.object({
  name: z.string().trim().min(1, 'Give the category a name').max(40, 'Name is too long').optional(),
  sortOrder: z.number().int().nonnegative().optional(),
  active: z.boolean().optional(),
  icon: z.string().trim().max(40).nullable().optional(),
});

export const CategoryRecord = z.object({
  id: z.string(),
  storeId: z.string(),
  name: z.string(),
  sortOrder: z.number().int().nonnegative(),
  active: z.boolean(),
  icon: z.string().nullable(),
  // true when a cover photo exists (bytes live in the DB, served by
  // /api/public/store/categories/[categoryId]/image).
  hasCover: z.boolean(),
  // Live count of items pointing at it. The manager uses this to refuse a
  // delete with "move N products first" instead of silently orphaning them.
  itemCount: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const CategoryList = z.object({ items: z.array(CategoryRecord) });

// Minimal public face for the storefront: id (so items can be grouped and
// filtered) plus the label. Item ids are already public — this matches.
export const CategorySummary = z.object({
  id: z.string(),
  name: z.string(),
  sortOrder: z.number().int().nonnegative(),
  icon: z.string().nullable(),
  coverUrl: z.string().nullable(),
});

export type CategoryCreateInput = z.infer<typeof CategoryCreate>;
export type CategoryUpdateInput = z.infer<typeof CategoryUpdate>;
export type CategoryRecord = z.infer<typeof CategoryRecord>;
export type CategorySummary = z.infer<typeof CategorySummary>;
