import * as React from "react";
import { Link } from "react-router-dom";
import { cva, type VariantProps } from "class-variance-authority";
import {
  Link2,
  Wallet,
  ChevronDown,
  Gem,
  Circle,
} from "lucide-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";

import { cn } from "@/lib/utils";
import { useWallet } from "./WalletProvider";

// ─── Button ────────────────────────────────────────────────────────────────────

const buttonVariants = cva(
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
  }
);

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

// ─── Badge ─────────────────────────────────────────────────────────────────────

type BadgeTier = "grey" | "blue" | "green" | "gold" | "diamond";

interface BadgeConfig {
  label: string;
  dotClass: string;
  containerClass: string;
}

const BADGE_CONFIG: Record<BadgeTier, BadgeConfig> = {
  grey: {
    label: "Grey",
    dotClass: "bg-ok-grey",
    containerClass:
      "border-ok-grey/25 bg-ok-grey/10 text-ok-grey",
  },
  blue: {
    label: "Blue",
    dotClass: "bg-ok-blue",
    containerClass:
      "border-ok-blue/25 bg-ok-blue/10 text-ok-blue",
  },
  green: {
    label: "Green",
    dotClass: "bg-ok-green",
    containerClass:
      "border-ok-green/25 bg-ok-green/10 text-ok-green",
  },
  gold: {
    label: "Gold",
    dotClass: "bg-ok-gold",
    containerClass:
      "border-ok-gold/25 bg-ok-gold/10 text-ok-gold",
  },
  diamond: {
    label: "Diamond",
    dotClass: "bg-cyan-400",
    containerClass:
      "border-cyan-400/25 bg-cyan-400/10 text-cyan-300",
  },
};

function getBadgeTier(score: number): BadgeTier {
  if (score >= 100) return "diamond";
  if (score >= 76) return "gold";
  if (score >= 51) return "green";
  if (score >= 26) return "blue";
  return "grey";
}

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tier: BadgeTier;
}

function Badge({ tier, className, children, ...props }: BadgeProps) {
  const config = BADGE_CONFIG[tier];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        config.containerClass,
        className
      )}
      {...props}
    >
      {tier === "diamond" ? (
        <Gem className="h-3 w-3" />
      ) : (
        <Circle className={cn("h-2 w-2 fill-current", config.dotClass)} />
      )}
      {children ?? config.label}
    </span>
  );
}

// ─── Card ──────────────────────────────────────────────────────────────────────

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  padding?: "none" | "sm" | "md" | "lg";
}

const CARD_PADDING = {
  none: "",
  sm: "p-3",
  md: "p-5",
  lg: "p-7",
} as const;

function Card({ className, padding = "md", children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-ok)] border border-ok-border bg-ok-surface shadow-lg shadow-black/20",
        CARD_PADDING[padding],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

// ─── WalletButton ──────────────────────────────────────────────────────────────

function truncateAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

interface WalletButtonProps {
  connected?: boolean;
  wallet?: string;
  score?: number;
  onClick?: () => void;
  className?: string;
}

function WalletButton({
  connected = false,
  wallet,
  score = 0,
  onClick,
  className,
}: WalletButtonProps) {
  if (connected && wallet) {
    const tier = getBadgeTier(score);
    const badgeConfig = BADGE_CONFIG[tier];

    return (
      <button
        onClick={onClick}
        className={cn(
          "inline-flex items-center gap-2.5 rounded-[var(--radius-ok)] border border-ok-border bg-ok-surface px-3.5 py-2 text-sm font-medium text-ok-text transition-all duration-150 hover:border-ok-green/30 hover:bg-ok-green/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ok-green/50",
          className
        )}
      >
        <span className="flex items-center gap-1.5">
          <Wallet className="h-4 w-4 text-ok-green" />
          <span className="font-mono text-xs">{truncateAddress(wallet)}</span>
        </span>

        <span className="h-4 w-px bg-ok-border" />

        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium",
            badgeConfig.containerClass
          )}
        >
          {tier === "diamond" ? (
            <Gem className="h-2.5 w-2.5" />
          ) : (
            <Circle
              className={cn("h-1.5 w-1.5 fill-current", badgeConfig.dotClass)}
            />
          )}
          {badgeConfig.label}
        </span>

        <ChevronDown className="h-3.5 w-3.5 text-ok-muted" />
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 rounded-[var(--radius-ok)] bg-ok-green px-4 py-2 text-sm font-medium text-ok-bg shadow-[0_0_20px_rgba(20,241,149,0.15)] transition-all duration-150 hover:bg-ok-green/90 hover:shadow-[0_0_28px_rgba(20,241,149,0.25)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ok-green/50 active:scale-[0.97]",
        className
      )}
    >
      <Wallet className="h-4 w-4" />
      Connect Wallet
    </button>
  );
}

// ─── SOLAmount ─────────────────────────────────────────────────────────────────

function formatLamports(lamports: number): string {
  const sol = lamports / 1_000_000_000;
  return sol.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  });
}

interface SOLAmountProps extends React.HTMLAttributes<HTMLSpanElement> {
  amount: number;
  unit?: "lamports" | "sol";
  showSymbol?: boolean;
}

function SOLAmount({
  amount,
  unit = "lamports",
  showSymbol = true,
  className,
  ...props
}: SOLAmountProps) {
  const displayValue = unit === "lamports" ? formatLamports(amount) : amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 });

  return (
    <span className={cn("inline-flex items-center gap-1 font-mono", className)} {...props}>
      {showSymbol && (
        <span className="text-ok-green text-[0.9em]">◎</span>
      )}
      <span className="text-ok-text">{displayValue}</span>
      {showSymbol && (
        <span className="text-ok-muted text-xs font-sans">SOL</span>
      )}
    </span>
  );
}

// ─── StatusPill ────────────────────────────────────────────────────────────────

type StatusType = "active" | "closed" | "distributing";

interface StatusConfig {
  label: string;
  dotClass: string;
  containerClass: string;
}

const STATUS_CONFIG: Record<StatusType, StatusConfig> = {
  active: {
    label: "Active",
    dotClass: "bg-ok-green animate-pulse",
    containerClass: "border-ok-green/25 bg-ok-green/10 text-ok-green",
  },
  closed: {
    label: "Closed",
    dotClass: "bg-ok-muted",
    containerClass: "border-ok-border bg-ok-border/30 text-ok-muted",
  },
  distributing: {
    label: "Distributing",
    dotClass: "bg-ok-purple animate-pulse",
    containerClass: "border-ok-purple/25 bg-ok-purple/10 text-ok-purple",
  },
};

interface StatusPillProps extends React.HTMLAttributes<HTMLSpanElement> {
  status: StatusType;
}

function StatusPill({ status, className, children, ...props }: StatusPillProps) {
  const config = STATUS_CONFIG[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        config.containerClass,
        className
      )}
      {...props}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", config.dotClass)} />
      {children ?? config.label}
    </span>
  );
}

// ─── Navbar ────────────────────────────────────────────────────────────────────

interface NavItem {
  label: string;
  href: string;
}

interface NavbarProps {
  items?: NavItem[];
  score?: number;
  className?: string;
}

const DEFAULT_NAV_ITEMS: NavItem[] = [
  { label: "Explore Forms", href: "/explore" },
  { label: "How It Works", href: "/how-it-works" },
  { label: "Pricing", href: "/pricing" },
];

function Navbar({
  items = DEFAULT_NAV_ITEMS,
  score = 0,
  className,
}: NavbarProps) {
  const { connected, publicKey, disconnect } = useWallet();
  const { setVisible } = useWalletModal();

  const handleWalletClick = () => {
    if (connected) {
      disconnect();
    } else {
      setVisible(true);
    }
  };

  return (
    <nav
      className={cn(
        "sticky top-0 z-50 flex items-center justify-between border-b border-ok-border bg-ok-surface/80 px-6 py-3 backdrop-blur-xl",
        className
      )}
    >
      {/* Logo */}
      <Link to="/" className="flex items-center gap-2 text-ok-text no-underline">
        <Link2 className="h-5 w-5 text-ok-green" strokeWidth={2.5} />
        <span className="font-display text-lg font-bold tracking-tight">
          Okaform
        </span>
      </Link>

      {/* Nav Links */}
      <div className="hidden items-center gap-8 md:flex">
        {items.map((item) => (
          <Link
            key={item.href}
            to={item.href}
            className="text-sm font-medium text-ok-muted transition-colors duration-150 hover:text-ok-text"
          >
            {item.label}
          </Link>
        ))}
      </div>

      {/* Wallet */}
      <WalletButton
        connected={connected}
        wallet={publicKey?.toBase58()}
        score={score}
        onClick={handleWalletClick}
      />
    </nav>
  );
}

// ─── Exports ───────────────────────────────────────────────────────────────────

export {
  Button,
  buttonVariants,
  Badge,
  getBadgeTier,
  Card,
  WalletButton,
  SOLAmount,
  StatusPill,
  Navbar,
  truncateAddress,
  formatLamports,
};

export type {
  ButtonProps,
  BadgeProps,
  BadgeTier,
  CardProps,
  WalletButtonProps,
  SOLAmountProps,
  StatusPillProps,
  NavbarProps,
  NavItem,
  StatusType,
};
