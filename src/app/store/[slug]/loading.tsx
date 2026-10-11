// Skeleton for /store/[slug]: the hero band, the shop mark and a shelf of
// cards, so a visitor on a slow connection sees the page's shape immediately
// instead of a blank screen while the catalog query runs.
export default function StoreLoading() {
  return (
    <div className="min-h-screen animate-pulse" aria-busy="true">
      <div className="h-56 w-full bg-muted sm:h-72" />
      <div className="mx-auto max-w-6xl space-y-8 p-6 sm:p-12">
        <div className="space-y-3">
          <div className="size-24 rounded-3xl bg-muted" />
          <div className="h-12 w-2/3 max-w-md rounded-2xl bg-muted" />
          <div className="h-5 w-40 rounded-full bg-muted" />
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {['a', 'b', 'c', 'd', 'e', 'f'].map((key) => (
            <div key={key} className="h-72 rounded-2xl bg-muted" />
          ))}
        </div>
      </div>
    </div>
  );
}
