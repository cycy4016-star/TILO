// Skeleton for /store/[slug]: the masthead bar, the hero band and a grid of
// cards, so a visitor on a slow connection sees the page's shape immediately
// instead of a blank screen while the catalog query runs.
export default function StoreLoading() {
  return (
    <div className="min-h-screen animate-pulse bg-background" aria-busy="true">
      {/* Masthead */}
      <div className="sticky top-0 z-50 border-b border-border bg-card">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 sm:h-16">
          <div className="size-8 rounded-md bg-muted sm:size-9" />
          <div className="h-4 w-32 rounded-full bg-muted" />
          <div className="ml-auto h-10 w-24 rounded-md bg-muted" />
        </div>
        <div className="px-4 pb-3 sm:hidden">
          <div className="h-10 w-full rounded-md bg-muted" />
        </div>
      </div>
      <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 pt-6 sm:pt-8">
        {/* Shop front */}
        <div className="h-52 rounded-xl bg-muted" />
        {/* Trust strip */}
        <div className="h-14 rounded-lg bg-muted" />
        {/* Promo band */}
        <div className="h-12 rounded-lg bg-muted" />
        {/* Cards */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
          {['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((key) => (
            <div key={key} className="h-72 rounded-lg bg-muted" />
          ))}
        </div>
      </div>
    </div>
  );
}
