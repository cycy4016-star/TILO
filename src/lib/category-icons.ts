// Shelf icon allowlist: the only icon keys a category may carry. Client-safe
// so the manager picker, the API guard and the storefront render the same set.
import {
  Baby,
  Book,
  Camera,
  Coffee,
  Gem,
  Gift,
  type LucideIcon,
  Music,
  Palette,
  Shirt,
  ShoppingBag,
  Smartphone,
  UtensilsCrossed,
  Watch,
  Wrench,
} from 'lucide-react';

export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  shirt: Shirt,
  food: UtensilsCrossed,
  art: Palette,
  baby: Baby,
  books: Book,
  camera: Camera,
  coffee: Coffee,
  jewelry: Gem,
  gifts: Gift,
  music: Music,
  bag: ShoppingBag,
  phone: Smartphone,
  watch: Watch,
  tools: Wrench,
};

export function isCategoryIcon(value: string | null | undefined): boolean {
  if (!value) return true;
  return Object.hasOwn(CATEGORY_ICONS, value);
}

export function categoryIconLabel(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
