// Shown while a dashboard route renders on the server. The shell (nav, header)
// comes from the layout immediately; this fills the content column so a slow
// query never leaves a blank page.
export default function DashboardLoading() {
  return (
    <div className="mx-auto w-full max-w-6xl animate-pulse space-y-6 p-6" aria-busy="true">
      <div className="h-8 w-48 rounded-lg bg-muted" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {['a', 'b', 'c', 'd', 'e', 'f'].map((key) => (
          <div key={key} className="h-28 rounded-2xl bg-muted" />
        ))}
      </div>
      <div className="h-64 rounded-2xl bg-muted" />
    </div>
  );
}
