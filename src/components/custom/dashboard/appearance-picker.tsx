// The dashboard's platform color picker — the swatch button in the header
// (next to the notification bell). One tap opens the color themes; the
// selection is applied to <html> instantly and persisted per-user via
// /api/appearance, so each account owns the dashboard's look. The corporate
// default is Slate. The public storefront renders one unified corporate
// layout regardless (unaffected here).
'use client';

import { Palette } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { apiFetch } from '@/lib/api-client';
import { AppearancePreferencePayload } from '@/lib/contracts/appearance';
import type { ThemeKeyValue } from '@/lib/contracts/store';
import {
  DEFAULT_THEME,
  getThemePreset,
  normalizeTheme,
  THEME_PRESETS,
  type ThemePreset,
} from '@/lib/theme';

function applyThemeToHtml(theme: ThemeKeyValue) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.appearance = 'professional';
}

export function AppearancePicker() {
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<ThemeKeyValue>(DEFAULT_THEME);
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
        applyThemeToHtml(normalizeTheme(saved.theme));
      } catch {
        // Auth-gated; if it fails, the slate default already applies.
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  // Optimistically apply the pick in the browser right away, then persist.
  const save = useCallback(
    async (nextTheme: ThemeKeyValue) => {
      applyThemeToHtml(nextTheme);
      setTheme(nextTheme);
      if (saving) return;
      setSaving(true);
      try {
        const saved = await apiFetch('/api/appearance', {
          method: 'PUT',
          body: JSON.stringify({ theme: nextTheme }),
          schema: AppearancePreferencePayload,
        });
        applyThemeToHtml(normalizeTheme(saved.theme));
        setTheme(normalizeTheme(saved.theme));
      } catch {
        // Persist failed — keep the optimistic pick applied; the next successful
        // load reconciles with the server.
      } finally {
        setSaving(false);
      }
    },
    [saving],
  );

  const activePreset = getThemePreset(theme);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Change the platform's look"
          className="relative size-9 rounded-md border border-border bg-background text-foreground hover:bg-muted"
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
        <p className="px-1 pb-2 text-small font-semibold text-foreground">Platform look</p>

        <div className="px-1 pb-1 text-eyebrow">Color theme</div>
        <div className="grid gap-2">
          {THEME_PRESETS.map((preset: ThemePreset) => {
            const selected = theme === preset.key;
            return (
              <button
                key={preset.key}
                type="button"
                aria-pressed={selected}
                disabled={saving}
                onClick={() => void save(preset.key)}
                className={`flex items-center gap-2.5 rounded-md border border-border px-3 py-2.5 text-left transition-colors disabled:opacity-60 ${
                  selected
                    ? 'bg-primary/5 ring-2 ring-ring ring-offset-2 ring-offset-background'
                    : 'hover:bg-muted'
                }`}
              >
                <span className="flex shrink-0 -space-x-1">
                  <span
                    aria-hidden
                    className="size-8 rounded-md border border-border"
                    style={{ backgroundColor: preset.accents[0] }}
                  />
                  <span
                    aria-hidden
                    className="size-8 rounded-md border border-border"
                    style={{ backgroundColor: preset.accents[1] }}
                  />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-caption font-medium">{preset.label}</span>
                  <span className="block truncate text-caption text-muted-foreground">
                    {preset.tagline}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        <p className="px-1 pt-3 text-caption text-muted-foreground">
          This is your platform look — the public storefront keeps its own.
        </p>
      </PopoverContent>
    </Popover>
  );
}
