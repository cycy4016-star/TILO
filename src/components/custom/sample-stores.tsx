// Sample shop data for the marketing home: the store objects behind the
// storefront snapshots. The stage (store-stage.tsx) renders them as phone
// mockups plus a transposed comparison table.
export type SampleProduct = {
  name: string;
  shelf: string;
  price: string;
  was: string | null;
  badge: string | null;
  image: string;
};

export type SampleShop = {
  name: string;
  slug: string;
  tagline: string;
  shelves: string[];
  products: SampleProduct[];
  basket: { count: number; total: string } | null;
};
