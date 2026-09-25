// The dashboard's platform look picker — the swatch button in the header (next
// to the notification bell). One tap opens the theme + appearance presets; the
// selection is applied to <html> instantly and persisted per-user via
// /api/appearance, so each account owns the whole dashboard's look. The public
// storefront keeps its own per-store appearance (unaffected here).
'use client';

import { Check, Palette } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { apiFetch } from '@/lib/api-client';
import { AppearancePreferencePayload } from '@/lib/contracts/appearance';
import type { AppearanceKeyValue, ThemeKeyValue } from '@/lib/contracts/store';
import {
  APPEARANCE_PRESETS,
  DEFAULT_APPEARANCE,
  DEFAULT_THEME,
  getThemePreset,
  normalizeAppearance,
  normalizeTheme,
  THEME_PRESETS,
  type ThemePreset,
} from '@/lib/theme';

function applyToHtml(theme: ThemeKeyValue, appearance: AppearanceKeyValue) {
  const html = document.documentElement;
  html.dataset.theme = theme;
  html.dataset.appearance = appearance;
}

export function AppearancePicker() {
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<ThemeKeyValue>(DEFAULT_THEME);
  const [appearance, setAppearance] = useState<AppearanceKeyValue>(DEFAULT_APPEARANCE);
  const [saving, setSaving] = useState(false);

  // Load the saved preference once on mount and reflect it on <html>, so the
  // dashboard renders in the user's look on every load.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const saved = await apiFetch('/api/appearance', { schema: AppearancePreferencePayload });
        if (cancelled) return;
        setTheme(normalizeTheme(saved.theme));
        setAppearance(normalizeAppearance(saved.appearance));
        applyToHtml(saved.theme, saved.appearance);
      } catch {
        // Auth-gated; if it fails, defaults (gold + vibrant) already apply.
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  // Optimistically apply the pick in the browser right away, then persist.
  const save = useCallback(
    async (next: Partial<{ theme: ThemeKeyValue; appearance: AppearanceKeyValue }>) => {
      const draft = {
        theme: next.theme ?? theme,
        appearance: next.appearance ?? appearance,
      };
      applyToHtml(draft.theme, draft.appearance);
      if (next.theme) setTheme(next.theme);
      if (next.appearance) setAppearance(next.appearance);
      if (saving) return;
      setSaving(true);
      try {
        const saved = await apiFetch('/api/appearance', {
          method: 'PUT',
          body: JSON.stringify(next),
          schema: AppearancePreferencePayload,
        });
        applyToHtml(saved.theme, saved.appearance);
        setTheme(saved.theme);
        setAppearance(saved.appearance);
      } catch {
        // Persist failed — keep the optimistic pick applied; the next successful
        // load reconciles with the server.
      } finally {
        setSaving(false);
      }
    },
    [appearance, saving, theme],
  );

  const activePreset = getThemePreset(theme);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Change the platform's look"
          className="relative size-9 rounded-full border border-border bg-transparent text-foreground hover:bg-muted"
        >
          <Palette aria-hidden className="size-4" />
          <span
            aria-hidden
            className="absolute -right-0.5 -top-0.5 flex size-3.5 items-center justify-center rounded-full border border-background"
            style={{ backgroundColor: activePreset.accents[0] }}
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="max-h-[70vh] w-80 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-xl border border-border bg-popover p-3 shadow-md"
      >
        <p className="px-1 pb-2 text-sm font-semibold">Platform look</p>

        <div className="px-1 pb-1 text-[0.65rem] font-semibold uppercase tracking-widest text-muted-foreground">
          Color theme
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {THEME_PRESETS.map((preset: ThemePreset) => {
            const selected = theme === preset.key;
            return (
              <button
                key={preset.key}
                type="button"
                aria-pressed={selected}
                disabled={saving}
                onClick={() => void save({ theme: preset.key })}
                className={`flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-colors disabled:opacity-60 ${
                  selected ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted'
                }`}
              >
                <span className="flex shrink-0 -space-x-1">
                  <span
                    aria-hidden
                    className="size-5 rounded-full border-2 border-background"
                    style={{ backgroundColor: preset.accents[0] }}
                  />
                  <span
                    aria-hidden
                    className="size-5 rounded-full border-2 border-background"
                    style={{ backgroundColor: preset.accents[1] }}
                  />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{preset.label}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {preset.tagline}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="px-1 pb-1 pt-3 text-[0.65rem] font-semibold uppercase tracking-widest text-muted-foreground">
          Layout &amp; appearance
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {APPEARANCE_PRESETS.map((preset) => {
            const selected = appearance === preset.key;
            return (
              <button
                key={preset.key}
                type="button"
                aria-pressed={selected}
                disabled={saving}
                onClick={() => void save({ appearance: preset.key })}
                className={`relative flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-colors disabled:opacity-60 ${
                  selected ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted'
                }`}
              >
                {selected && (
                  <Check aria-hidden className="absolute right-2 top-2 size-3.5 text-primary" />
                )}
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{preset.label}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {preset.tagline}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        <p className="px-1 pt-3 text-[0.7rem] text-muted-foreground">
          This is your platform look — the public storefront keeps its own.
        </p>
      </PopoverContent>
    </Popover>
  );
}
