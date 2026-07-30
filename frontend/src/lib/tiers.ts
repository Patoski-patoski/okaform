import { cva } from "class-variance-authority";

export type BadgeTier = "grey" | "blue" | "green" | "gold" | "diamond";

export interface BadgeConfig {
  label: string;
  dotClass: string;
  containerClass: string;
}

export const BADGE_CONFIG: Record<BadgeTier, BadgeConfig> = {
  grey: {
    label: "Ghost",
    dotClass: "bg-ok-grey",
    containerClass: "border-ok-grey/25 bg-ok-grey/10 text-ok-grey",
  },
  blue: {
    label: "Cipher",
    dotClass: "bg-ok-blue",
    containerClass: "border-ok-blue/25 bg-ok-blue/10 text-ok-blue",
  },
  green: {
    label: " Sentinel",
    dotClass: "bg-ok-green",
    containerClass: "border-ok-green/25 bg-ok-green/10 text-ok-green",
  },
  gold: {
    label: "Oracle",
    dotClass: "bg-ok-gold",
    containerClass: "border-ok-gold/25 bg-ok-gold/10 text-ok-gold",
  },
  diamond: {
    label: "Sovereign",
    dotClass: "bg-cyan-400",
    containerClass: "border-cyan-400/25 bg-cyan-400/10 text-cyan-300",
  },
};

export const BADGE_LABEL_TO_TIER: Record<string, BadgeTier> = {
  ghost: "grey",
  cipher: "blue",
  sentinel: "green",
  oracle: "gold",
  sovereign: "diamond",
};

export function tierFromLabel(label: string): BadgeTier {
  return BADGE_LABEL_TO_TIER[label.toLowerCase().trim()] ?? "grey";
}

export function getBadgeTier(score: number): BadgeTier {
  if (score >= 100) return "diamond";
  if (score >= 76) return "gold";
  if (score >= 51) return "green";
  if (score >= 26) return "blue";
  return "grey";
}

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-[var(--radius-ok)] font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ok-green/50 focus-visible:ring-offset-2 focus-visible:ring-offset-ok-bg disabled:pointer-events-none disabled:opacity-50 active:scale-[0.97]",
  {
    variants: {
      variant: {
        primary:
          "bg-ok-green text-ok-bg hover:bg-ok-green/90 shadow-[0_0_20px_rgba(20,241,149,0.15)] hover:shadow-[0_0_28px_rgba(20,241,149,0.25)]",
        secondary:
          "border border-ok-green/40 bg-transparent text-ok-green hover:bg-ok-green/10 hover:border-ok-green/60",
        danger:
          "bg-ok-danger/15 text-ok-danger border border-ok-danger/25 hover:bg-ok-danger/25 hover:border-ok-danger/40",
      },
      size: {
        sm: "h-8 px-3 text-xs",
        md: "h-10 px-5 text-sm",
        lg: "h-12 px-7 text-base",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);
