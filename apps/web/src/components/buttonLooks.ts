/**
 * DeckDiff's own Button looks. Use with the design system's Button as
 * `<Button variant={null} className={cn(buttonLooks.iconGhost, ...)} />`: Button keeps its
 * structure, focus ring and disabled handling, and these classes supply the look.
 */
export const buttonLooks = {
  /** Quiet icon control used in headers and lists. */
  iconGhost: "rounded-lg text-muted-foreground hover:bg-secondary hover:text-secondary-foreground",
  /** Amber icon control for warning banners. amber-100 hover text has no token. */
  warningGhost: "rounded-lg text-warning-text hover:bg-warning-border/30 hover:text-amber-100",
  /** Translucent control over card art. */
  glass: "bg-on-image/35 text-on-image-foreground backdrop-blur-sm hover:bg-on-image/50",
  /** Segment inside the card-art control rail; the rail owns the shared glass background. */
  overlay: "rounded-none text-on-image-foreground hover:bg-on-image-hover",
  /** Elevated floating action (feedback button). */
  raised:
    "border border-border-strong bg-secondary text-secondary-foreground shadow-lg shadow-black/40 hover:bg-border-strong hover:text-highlight",
} as const;
