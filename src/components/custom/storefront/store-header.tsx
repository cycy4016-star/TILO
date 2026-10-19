// Sticky shop chrome for /store/[slug] — the marketplace masthead. Owns almost
// no state: the search text and basket count are lifted to the storefront shell
// so the header, the grid and the basket bar always agree. The only local state
// is whether the search suggestions panel is open.
//
// The bar paints with the shop's own theme ramp (--tl-*), so every preset
// re-skins the chrome without a theme-specific class anywhere.
'use client';

import { Clock, Search, ShoppingCart, X } from 'lucide-react';
import Image from 'next/image';
import { useState } from 'react';

export type SearchSuggestion = { label: string; count: number };

export function StoreHeader({
  storeName,
  logoUrl,
  query,
  onQueryChange,
  suggestions = [],
  recentSearches = [],
  onSubmitQuery,
  onClearRecent,
  cartCount,
  onCartOpen,
}: {
  storeName: string;
  logoUrl: string | null;
  query: string;
  onQueryChange: (value: string) => void;
  /** Shelf names the shopper can jump to by typing a prefix. */
  suggestions?: SearchSuggestion[];
  /** Device-local past searches, newest first. */
  recentSearches?: string[];
  /** Called with a committed term (Enter or a suggestion pick), never per keystroke. */
  onSubmitQuery?: (value: string) => void;
  onClearRecent?: () => void;
  cartCount: number;
  onCartOpen: () => void;
}) {
  const [focused, setFocused] = useState(false);
  const initial = storeName.trim().charAt(0).toUpperCase() || 'S';

  const needle = query.trim().toLowerCase();
  const matchingShelves = needle
    ? suggestions
        .filter(
          (suggestion) =>
            suggestion.label.toLowerCase().includes(needle) &&
            suggestion.label.toLowerCase() !== needle,
        )
        .slice(0, 5)
    : [];
  const showRecent = needle === '' && recentSearches.length > 0;
  const showPanel = focused && (showRecent || matchingShelves.length > 0);

  function commit(value: string) {
    onQueryChange(value);
    onSubmitQuery?.(value);
    setFocused(false);
  }

  const searchField = (
    // `<search>` is the semantic landmark; `role="search"` would be the ARIA
    // fallback for browsers that predate the element.
    <search className="block w-full">
      <form
        className="relative w-full"
        onSubmit={(event) => {
          event.preventDefault();
          commit(query);
        }}
      >
        <Search
          aria-hidden
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <input
          type="text"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={`Search ${storeName}…`}
          aria-label={`Search ${storeName}`}
          autoComplete="off"
          className="h-10 w-full rounded-lg border bg-background pl-9 pr-9 text-small text-foreground shadow-xs outline-none ring-1 ring-border transition placeholder:text-muted-foreground focus:ring-2 focus:ring-highlight"
        />
        {query ? (
          <button
            type="button"
            onClick={() => {
              onQueryChange('');
              onSubmitQuery?.('');
            }}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X aria-hidden className="size-3.5" />
          </button>
        ) : null}

        {showPanel && (
          // Suggestion panel. `onMouseDown` is prevented so picking an entry does
          // not blur the field first and unmount the panel mid-click.
          <div className="absolute inset-x-0 top-full z-50 mt-1.5 overflow-hidden rounded-lg border border-border bg-card shadow-lg">
            {showRecent ? (
              <>
                <div className="flex items-center justify-between gap-3 px-3 pb-1 pt-2.5">
                  <span className="text-caption font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Recent searches
                  </span>
                  <button
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => onClearRecent?.()}
                    className="text-caption font-medium text-primary transition-colors hover:text-primary/80"
                  >
                    Clear
                  </button>
                </div>
                <div className="pb-1">
                  {recentSearches.slice(0, 6).map((term) => (
                    <button
                      key={term}
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => commit(term)}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-small transition-colors hover:bg-muted"
                    >
                      <Clock aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
                      <span className="truncate">{term}</span>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <div className="py-1">
                <p className="px-3 pb-1 pt-2 text-caption font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Shelves
                </p>
                {matchingShelves.map((suggestion) => (
                  <button
                    key={suggestion.label}
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => commit(suggestion.label)}
                    className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-small transition-colors hover:bg-muted"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <Search aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
                      <span className="truncate">{suggestion.label}</span>
                    </span>
                    <span className="shrink-0 text-caption text-muted-foreground">
                      {suggestion.count}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </form>
    </search>
  );

  return (
    // White with a hairline, not a dark blue bar. On a pure-white page a dark
    // masthead was the only remaining painted surface, and it fought the banner
    // photo directly beneath it. The basket button stays orange — it is the
    // shop's one persistent energy moment.
    <header className="sticky top-0 z-50 border-b border-border bg-background">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 sm:h-16">
        <a href="#top" className="flex min-w-0 items-center gap-2.5">
          {logoUrl ? (
            <Image
              src={logoUrl}
              alt=""
              width={64}
              height={64}
              sizes="(max-width: 640px) 32px, 36px"
              className="size-8 shrink-0 rounded-lg bg-white object-contain p-0.5 ring-1 ring-border sm:size-9"
            />
          ) : (
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-highlight font-display text-small font-bold text-highlight-foreground sm:size-9">
              {initial}
            </span>
          )}
          <span className="truncate font-display text-body font-semibold tracking-tight text-foreground">
            {storeName}
          </span>
        </a>

        {/* Desktop: the search sits in the bar, marketplace-style */}
        <div className="mx-auto hidden max-w-xl flex-1 px-6 sm:block">{searchField}</div>

        <button
          type="button"
          onClick={onCartOpen}
          className="ml-auto flex h-10 shrink-0 items-center gap-2 rounded-lg bg-highlight px-3.5 text-small font-semibold text-highlight-foreground transition-transform active:scale-[0.98] sm:ml-0 sm:px-4"
        >
          <ShoppingCart aria-hidden className="size-4.5" />
          <span className="hidden sm:inline">Basket</span>
          {cartCount > 0 && (
            <span className="grid min-w-5 place-items-center rounded-full bg-white px-1.5 py-0.5 text-caption font-bold text-foreground ring-1 ring-border">
              {cartCount}
            </span>
          )}
          <span className="sr-only">
            {cartCount > 0
              ? `${cartCount} ${cartCount === 1 ? 'item' : 'items'} in basket`
              : 'Basket is empty'}
          </span>
        </button>
      </div>
      {/* Mobile: the search gets its own row so it can stay usable */}
      <div className="px-4 pb-3 sm:hidden">{searchField}</div>
    </header>
  );
}
