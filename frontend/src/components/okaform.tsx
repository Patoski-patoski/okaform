import { type ButtonHTMLAttributes, type HTMLAttributes, type ReactNode } from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Wallet, Link2, Gem } from "lucide-react"
import { cn } from "../lib/utils"

/* -------------------------------------------------------------------------- */
/*  Button                                                                    */
/* -------------------------------------------------------------------------- */

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-ok font-display font-medium whitespace-nowrap transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ok-green/60 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-ok-green text-ok-bg hover:bg-ok-green/90",
        secondary:
          "border border-ok-green/60 bg-transparent text-ok-green hover:bg-ok-green/10",
        danger: "bg-ok-danger text-ok-bg hover:bg-ok-danger/90",
      },
      size: {
        sm: "h-8 px-3 text-sm",
        md: "h-10 px-4 text-sm",
        lg: "h-12 px-6 text-base",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
)

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return (
    <button className={cn(buttonVariants({ variant, size }), className)} {...props} />
  )
}

/* -------------------------------------------------------------------------- */
/*  Badge — 5 reputation tiers                                                */
/* -------------------------------------------------------------------------- */

export type BadgeTier = "grey" | "blue" | "green" | "gold" | "diamond"

const TIER_CONFIG: Record<
  BadgeTier,
  { label: string; dot: string; text: string; range: string }
> = {
  grey: { label: "Grey", dot: "bg-ok-grey", text: "text-ok-grey", range: "0–25" },
  blue: { label: "Blue", dot: "bg-ok-blue", text: "text-ok-blue", range: "26–50" },
  green: { label: "Green", dot: "bg-ok-green", text: "text-ok-green", range: "51–75" },
  gold: { label: "Gold", dot: "bg-ok-gold", text: "text-ok-gold", range: "76–100" },
  diamond: {
    label: "Diamond",
    dot: "bg-ok-diamond",
    text: "text-ok-diamond",
    range: "100+",
  },
}

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tier: BadgeTier
}

export function Badge({ tier, className, ...props }: BadgeProps) {
  const config = TIER_CONFIG[tier]
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-ok border border-ok-border bg-ok-surface px-2.5 py-1 font-sans text-xs font-medium",
        config.text,
        className,
      )}
      {...props}
    >
      {tier === "diamond" ? (
        <Gem className="size-3.5" aria-hidden="true" />
      ) : (
        <span className={cn("size-2 rounded-full", config.dot)} aria-hidden="true" />
      )}
      {config.label}
    </span>
  )
}

export { TIER_CONFIG }

/* -------------------------------------------------------------------------- */
/*  Card                                                                      */
/* -------------------------------------------------------------------------- */

const cardVariants = cva("rounded-ok border border-ok-border bg-ok-surface", {
  variants: {
    padding: {
      none: "p-0",
      sm: "p-3",
      md: "p-5",
      lg: "p-8",
    },
  },
  defaultVariants: {
    padding: "md",
  },
})

export interface CardProps
  extends HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {}

export function Card({ className, padding, ...props }: CardProps) {
  return <div className={cn(cardVariants({ padding }), className)} {...props} />
}

/* -------------------------------------------------------------------------- */
/*  SOLAmount                                                                 */
/* -------------------------------------------------------------------------- */

export interface SOLAmountProps extends HTMLAttributes<HTMLSpanElement> {
  amount: number | string
  /** show more decimals for precise on-chain values */
  decimals?: number
}

export function SOLAmount({
  amount,
  decimals = 2,
  className,
  ...props
}: SOLAmountProps) {
  const value =
    typeof amount === "number" ? amount.toFixed(decimals) : amount
  return (
    <span
      className={cn("inline-flex items-baseline gap-1 font-mono tabular-nums", className)}
      {...props}
    >
      <span className="text-ok-green" aria-hidden="true">
        ◎
      </span>
      <span className="text-ok-text">{value}</span>
      <span className="sr-only">SOL</span>
    </span>
  )
}

/* -------------------------------------------------------------------------- */
/*  StatusPill                                                                */
/* -------------------------------------------------------------------------- */

export type FormStatus = "active" | "closed" | "distributing"

const STATUS_CONFIG: Record<
  FormStatus,
  { label: string; className: string; dot: string }
> = {
  active: {
    label: "Active",
    className: "border-ok-green/30 bg-ok-green/10 text-ok-green",
    dot: "bg-ok-green",
  },
  closed: {
    label: "Closed",
    className: "border-ok-border bg-ok-surface text-ok-grey",
    dot: "bg-ok-grey",
  },
  distributing: {
    label: "Distributing",
    className: "border-ok-purple/40 bg-ok-purple/10 text-ok-purple",
    dot: "bg-ok-purple",
  },
}

export interface StatusPillProps extends HTMLAttributes<HTMLSpanElement> {
  status: FormStatus
}

export function StatusPill({ status, className, ...props }: StatusPillProps) {
  const config = STATUS_CONFIG[status]
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-ok border px-2.5 py-1 font-sans text-xs font-medium",
        config.className,
        className,
      )}
      {...props}
    >
      <span className={cn("size-2 rounded-full", config.dot)} aria-hidden="true" />
      {config.label}
    </span>
  )
}

/* -------------------------------------------------------------------------- */
/*  WalletButton                                                              */
/* -------------------------------------------------------------------------- */

export interface WalletButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** connected wallet address; when provided the button renders its connected state */
  address?: string
  /** reputation tier shown alongside a connected address */
  tier?: BadgeTier
}

function truncateAddress(address: string) {
  if (address.length <= 11) return address
  return `${address.slice(0, 4)}...${address.slice(-4)}`
}

export function WalletButton({
  address,
  tier,
  className,
  ...props
}: WalletButtonProps) {
  if (!address) {
    return (
      <button
        className={cn(
          "inline-flex h-10 items-center justify-center gap-2 rounded-ok bg-ok-green px-4 font-display text-sm font-medium text-ok-bg transition-colors hover:bg-ok-green/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ok-green/60",
          className,
        )}
        {...props}
      >
        <Wallet className="size-4" aria-hidden="true" />
        Connect Wallet
      </button>
    )
  }

  return (
    <button
      className={cn(
        "inline-flex h-10 items-center gap-2.5 rounded-ok border border-ok-border bg-ok-surface px-3 font-sans text-sm text-ok-text transition-colors hover:border-ok-green/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ok-green/60",
        className,
      )}
      {...props}
    >
      <span className="flex size-5 items-center justify-center rounded-full bg-ok-purple/20 text-ok-purple">
        <Wallet className="size-3" aria-hidden="true" />
      </span>
      <span className="font-mono">{truncateAddress(address)}</span>
      {tier && <Badge tier={tier} />}
    </button>
  )
}

/* -------------------------------------------------------------------------- */
/*  Navbar                                                                    */
/* -------------------------------------------------------------------------- */

export interface NavbarProps {
  links?: { label: string; href: string }[]
  wallet?: { address?: string; tier?: BadgeTier; onConnect?: () => void }
  className?: string
  children?: ReactNode
}

const DEFAULT_LINKS = [
  { label: "Explore", href: "#explore" },
  { label: "How it Works", href: "#how-it-works" },
  { label: "Pricing", href: "#pricing" },
]

export function Navbar({
  links = DEFAULT_LINKS,
  wallet,
  className,
}: NavbarProps) {
  return (
    <nav
      className={cn(
        "flex h-16 items-center justify-between gap-4 border-b border-ok-border bg-ok-bg px-6",
        className,
      )}
    >
      {/* Logo */}
      <a href="#" className="flex items-center gap-2 shrink-0">
        <span className="flex size-8 items-center justify-center rounded-ok bg-ok-green text-ok-bg">
          <Link2 className="size-4.5" aria-hidden="true" />
        </span>
        <span className="font-display text-lg font-bold tracking-tight text-ok-text">
          Okaform
        </span>
      </a>

      {/* Center links */}
      <ul className="hidden items-center gap-8 md:flex">
        {links.map((link) => (
          <li key={link.href}>
            <a
              href={link.href}
              className="font-sans text-sm font-medium text-ok-muted transition-colors hover:text-ok-text"
            >
              {link.label}
            </a>
          </li>
        ))}
      </ul>

      {/* Wallet */}
      <WalletButton
        address={wallet?.address}
        tier={wallet?.tier}
        onClick={wallet?.onConnect}
      />
    </nav>
  )
}
