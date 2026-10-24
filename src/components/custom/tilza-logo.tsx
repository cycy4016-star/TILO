// Tilza logo — the brand lockup.
//
// The supplied artwork is the source of truth. It scales from the surrounding
// type size (pass e.g. "text-xl"), so the same component works in the header,
// footer, auth shells and terminal. Use tone="light" on ink/dark surfaces.
import { brandLogo, brandLogoLight, siteName } from '@/lib/brand';
import { cn } from '@/lib/utils';

export interface TilzaLogoProps {
  /**
   * The lockup scales with the type size, so pass a text size (e.g. "text-xl",
   * "text-4xl") rather than box dimensions.
   */
  className?: string;
  /** Drop the trailing accent dot for a plainer lockup. Defaults to true. */
  withAccent?: boolean;
  /** Use the knockout artwork on ink/dark surfaces. */
  tone?: 'brand' | 'light';
}

export function TilzaLogo({ className, withAccent = true, tone = 'brand' }: TilzaLogoProps) {
  const logoSrc = tone === 'light' ? brandLogoLight : brandLogo;

  if (logoSrc) {
    return (
      // biome-ignore lint/performance/noImgElement: a static brand asset whose intrinsic size varies by placement, so next/image adds nothing.
      <img
        src={logoSrc}
        alt={siteName}
        style={{ width: 'auto', maxWidth: 'none' }}
        className={cn('inline-block h-[1.7em] shrink-0 object-contain', className)}
      />
    );
  }

  return (
    <span
      className={cn(
        'inline-flex select-none items-baseline font-display font-extrabold uppercase leading-none tracking-[-0.055em]',
        className,
      )}
      role="img"
      aria-label={siteName}
    >
      <span aria-hidden>Tilza</span>
      {withAccent && (
        <span aria-hidden className="text-highlight">
          .
        </span>
      )}
    </span>
  );
}
