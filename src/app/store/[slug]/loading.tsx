// Skeleton for /store/[slug]: the masthead bar, the hero band and a grid of
// cards, so a visitor on a slow connection sees the page's shape immediately
// instead of a blank screen while the catalog query runs.
export default function StoreLoading() {
  return (
    <div className="min-h-screen animate-pulse bg-background" aria-busy="true">
      {/* Masthead */}
      <div className="sticky top-0 z-50 bg-muted">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 sm:h-16">
          <div className="size-8 rounded-lg bg-background/60 sm:size-9" />
          <div className="h-4 w-32 rounded-full bg-background/60" />
          <div className="ml-auto h-10 w-24 rounded-lg bg-background/60" />
        </div>
        <div className="px-4 pb-3 sm:hidden">
          <div className="h-10 w-full rounded-lg bg-background/60" />
        </div>
      </div>
      <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 pt-6 sm:pt-8">
        {/* Hero band */}
        <div className="h-64 rounded-2xl bg-muted sm:h-72" />
        {/* Trust strip */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {['a', 'b', 'c', 'd'].map((key) => (
            <div key={key} className="h-14 rounded-xl bg-muted" />
          ))}
        </div>
        {/* Category rail */}
        <div className="flex gap-2.5">
          {['a', 'b', 'c', 'd', 'e'].map((key) => (
            <div key={key} className="h-10 w-28 shrink-0 rounded-full bg-muted" />
          ))}
        </div>
        {/* Cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((key) => (
            <div key={key} className="h-64 rounded-xl bg-muted" />
          ))}
        </div>
      </div>
    </div>
  );
}
