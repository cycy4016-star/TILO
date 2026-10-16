// Tilza logo — the brand lockup.
//
// Until an uploaded logo exists, the brand is set as type alone: "TILZA" in the
// display face (Bricolage Grotesque), extra-bold, tightly tracked, with a small
// primary-coloured accent dot. It draws in `currentColor`, so it inherits the
// colour of whatever surface it sits on (slate header, dark CTA band, card…).
//
// Swapping in your own logo later needs no markup changes anywhere:
//   1. Drop the file in /public (e.g. /public/logo.svg).
//   2. Set `brandLogo` in src/lib/brand.ts to its path.
// This component then renders that image instead of the wordmark.
import { brandLogo, siteName } from '@/lib/brand';
import { cn } from '@/lib/utils';

export interface TilzaLogoProps {
  /**
   * The lockup scales with the type size, so pass a text size (e.g. "text-xl",
   * "text-4xl") rather than box dimensions.
   */
  className?: string;
  /** Drop the trailing accent dot for a plainer lockup. Defaults to true. */
  withAccent?: boolean;
}

export function TilzaLogo({ className, withAccent = true }: TilzaLogoProps) {
  if (brandLogo) {
    return (
      // biome-ignore lint/performance/noImgElement: a static brand asset whose intrinsic size varies by placement, so next/image adds nothing.
      <img src={brandLogo} alt={siteName} className={className} />
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
        <span aria-hidden className="text-primary">
          .
        </span>
      )}
    </span>
  );
}
