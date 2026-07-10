import { Link } from "react-router-dom";
import {
  Link2,
  Wallet,
  ShieldCheck,
  BarChart3,
  Lock,
  Database,
  Circle,
  ArrowRight,
  Terminal,
  Users,
  Zap,
  ChevronRight,
} from "lucide-react";

import { Button, Badge, Card, StatusPill, SOLAmount, Navbar } from "@/components/okaform";
import { cn } from "@/lib/utils";

/* ──────────────────────────────────────────────────────────────────────────────
   Landing page — single component, all 7 sections.
   Bento grid layout. Tailwind only. Uses the okaform design system.
   ────────────────────────────────────────────────────────────────────────────── */

function Home() {
  return (
    <div className="min-h-screen bg-ok-bg">
      {/* ── 1. NAVBAR ──────────────────────────────────────────────────────── */}
      <Navbar
        items={[
          { label: "Explore Forms", href: "#explore" },
          { label: "How It Works", href: "#how-it-works" },
          { label: "Pricing", href: "#pricing" },
        ]}
      />

      {/* ── 2. HERO ────────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-6 pt-20 pb-24 lg:pt-28 lg:pb-32">
        <div className="grid items-center gap-12 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
          {/* Left — copy */}
          <div className="flex flex-col gap-8">
            {/* Eyebrow */}
            <div className="flex items-center gap-2.5">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ok-purple opacity-60" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-ok-purple" />
              </span>
              <span className="text-xs font-medium tracking-widest text-ok-purple uppercase">
                Built on Solana
              </span>
            </div>

            {/* Headline */}
            <h1 className="font-display text-4xl font-bold leading-[1.1] tracking-tight text-ok-text sm:text-5xl lg:text-[3.5rem]">
              Your Community's Opinions,{" "}
              <span className="text-ok-green">Verified On-Chain</span>
            </h1>

            {/* Subheadline */}
            <p className="max-w-lg text-base leading-relaxed text-ok-muted lg:text-lg">
              Launch incentivised surveys for your DAO or protocol.
              Bot-proof. Reputation-weighted. Automatically distributed.
            </p>

            {/* CTAs */}
            <div className="flex flex-wrap items-center gap-4">
              <Button variant="primary" size="lg">
                Create a Survey
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Button variant="secondary" size="lg">
                Explore Surveys
              </Button>
            </div>

            {/* Social proof */}
            <div className="flex flex-col gap-3 pt-2">
              <span className="text-xs font-medium text-ok-muted/60">
                Trusted by protocols on Solana
              </span>
              <div className="flex items-center gap-3">
                {["Jupiter", "Marinade", "Orca", "Raydium"].map((name) => (
                  <span
                    key={name}
                    className="inline-flex items-center gap-1.5 rounded-full border border-ok-border bg-ok-surface px-3 py-1 text-xs font-medium text-ok-muted/70"
                  >
                    <Circle className="h-1.5 w-1.5 fill-ok-muted/40 text-ok-muted/40" />
                    {name}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Right — floating mockup card */}
          <div className="hidden lg:block">
            <div className="relative rounded-[var(--radius-ok)] border border-white/10 bg-white/5 p-1 backdrop-blur-md">
              <div className="rounded-[10px] border border-ok-border bg-ok-surface p-6">
                {/* Card header */}
                <div className="mb-5 flex items-start justify-between">
                  <div>
                    <h3 className="font-display text-base font-semibold text-ok-text">
                      Jupiter Community Pulse
                    </h3>
                    <p className="mt-1 text-xs text-ok-muted">
                      Q2 2025 Governance Feedback
                    </p>
                  </div>
                  <StatusPill status="active" />
                </div>

                {/* Reward pool */}
                <div className="mb-5 flex items-center gap-3 rounded-[var(--radius-ok)] border border-ok-border bg-ok-bg p-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-ok-green/10">
                    <span className="text-sm text-ok-green">◎</span>
                  </div>
                  <div>
                    <p className="text-xs text-ok-muted">Reward Pool</p>
                    <SOLAmount amount={50} unit="sol" className="text-sm font-semibold" />
                  </div>
                </div>

                {/* Response bar */}
                <div className="mb-5">
                  <div className="mb-1.5 flex items-center justify-between text-xs">
                    <span className="text-ok-muted">Responses</span>
                    <span className="font-mono text-ok-text">234 / 500</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-ok-border">
                    <div
                      className="h-full rounded-full bg-ok-green transition-all"
                      style={{ width: "46.8%" }}
                    />
                  </div>
                </div>

                {/* Respondent rows */}
                <div className="space-y-2.5">
                  {[
                    { wallet: "7xKp...3mQr", tier: "diamond" as const },
                    { wallet: "9Yn2...8kLm", tier: "gold" as const },
                    { wallet: "4Vb1...6xNf", tier: "green" as const },
                  ].map((r) => (
                    <div
                      key={r.wallet}
                      className="flex items-center justify-between rounded-[var(--radius-ok)] border border-ok-border bg-ok-bg px-3 py-2"
                    >
                      <span className="flex items-center gap-2 font-mono text-xs text-ok-muted">
                        <Wallet className="h-3.5 w-3.5 text-ok-green/60" />
                        {r.wallet}
                      </span>
                      <Badge tier={r.tier} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 3. HOW IT WORKS ────────────────────────────────────────────────── */}
      <section id="how-it-works" className="border-t border-ok-border bg-ok-surface/40">
        <div className="mx-auto max-w-7xl px-6 py-24">
          <div className="mb-14 max-w-2xl">
            <h2 className="font-display text-3xl font-bold tracking-tight text-ok-text sm:text-4xl">
              How It Works
            </h2>
            <p className="mt-3 text-base text-ok-muted">
              Three steps from survey creation to on-chain reward distribution.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {[
              {
                num: "01",
                icon: <Terminal className="h-6 w-6" />,
                title: "Set Your Reward Pool",
                desc: "Lock SOL in escrow, configure who can respond — wallet age, token holdings, minimum balance.",
                role: "Creator",
              },
              {
                num: "02",
                icon: <Users className="h-6 w-6" />,
                title: "Verified Community Responds",
                desc: "Wallet-gated, sybil-filtered, reputation-scored answers only. No bots. Clean data.",
                role: "Respondents",
              },
              {
                num: "03",
                icon: <Zap className="h-6 w-6" />,
                title: "Rewards Flow On-Chain",
                desc: "Distributed automatically weighted by reputation badge. Zero manual work. Fully transparent.",
                role: "Auto-distribute",
              },
            ].map((step) => (
              <Card key={step.num} padding="lg" className="group relative">
                <span className="mb-6 inline-flex font-display text-4xl font-bold text-ok-green/15 transition-colors group-hover:text-ok-green/30">
                  {step.num}
                </span>
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-[var(--radius-ok)] border border-ok-border bg-ok-bg text-ok-green">
                  {step.icon}
                </div>
                <span className="mb-1 block text-[10px] font-semibold uppercase tracking-widest text-ok-purple">
                  {step.role}
                </span>
                <h3 className="mb-2 font-display text-lg font-semibold text-ok-text">
                  {step.title}
                </h3>
                <p className="text-sm leading-relaxed text-ok-muted">
                  {step.desc}
                </p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ── 4. FEATURES GRID (bento 2x2) ──────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-6 py-24">
        <div className="mb-14 max-w-2xl">
          <h2 className="font-display text-3xl font-bold tracking-tight text-ok-text sm:text-4xl">
            Built for Web3 Data
          </h2>
          <p className="mt-3 text-base text-ok-muted">
            Every feature is designed around on-chain identity and trust.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Card 1 — spans 2 cols on lg */}
          <Card padding="lg" className="md:col-span-2 md:row-span-1">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--radius-ok)] border border-ok-green/20 bg-ok-green/10">
                <ShieldCheck className="h-6 w-6 text-ok-green" />
              </div>
              <div>
                <h3 className="mb-2 font-display text-lg font-semibold text-ok-text">
                  Sybil Resistant
                </h3>
                <p className="text-sm leading-relaxed text-ok-muted">
                  Wallet age, SOL balance, and funding-graph analysis filter
                  bots before a single response is accepted. Every respondent
                  is a verified human with an on-chain history.
                </p>
              </div>
            </div>
          </Card>

          {/* Card 2 */}
          <Card padding="lg">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-[var(--radius-ok)] border border-ok-purple/20 bg-ok-purple/10">
              <BarChart3 className="h-6 w-6 text-ok-purple" />
            </div>
            <h3 className="mb-2 font-display text-lg font-semibold text-ok-text">
              Reputation Scores
            </h3>
            <p className="text-sm leading-relaxed text-ok-muted">
              Every respondent builds a global on-chain score across all
              surveys. Grey → Blue → Green → Gold → Diamond. Higher tiers
              earn larger reward shares.
            </p>
          </Card>

          {/* Card 3 */}
          <Card padding="lg">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-[var(--radius-ok)] border border-ok-green/20 bg-ok-green/10">
              <Lock className="h-6 w-6 text-ok-green" />
            </div>
            <h3 className="mb-2 font-display text-lg font-semibold text-ok-text">
              On-Chain Escrow
            </h3>
            <p className="text-sm leading-relaxed text-ok-muted">
              Reward pool locked in a Solana PDA. Distributed automatically
              when the survey closes. No trust required — the program
              enforces the rules.
            </p>
          </Card>

          {/* Card 4 — spans 2 cols on lg */}
          <Card padding="lg" className="md:col-span-2 md:row-span-1">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--radius-ok)] border border-ok-green/20 bg-ok-green/10">
                <Database className="h-6 w-6 text-ok-green" />
              </div>
              <div>
                <h3 className="mb-2 font-display text-lg font-semibold text-ok-text">
                  Clean Data
                </h3>
                <p className="text-sm leading-relaxed text-ok-muted">
                  Responses come from verified humans. Every answer is tagged
                  with a reputation badge. No sybil farms. No duplicate
                  wallets. Data you can actually use for governance.
                </p>
              </div>
            </div>
          </Card>
        </div>
      </section>

      {/* ── 5. BADGE TIERS ─────────────────────────────────────────────────── */}
      <section className="border-t border-ok-border bg-ok-surface/40">
        <div className="mx-auto max-w-7xl px-6 py-24">
          <div className="mb-14 text-center">
            <h2 className="font-display text-3xl font-bold tracking-tight text-ok-text sm:text-4xl">
              Earn More as You Grow
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-base text-ok-muted">
              Your Okaform Score grows with every quality survey you
              complete. Higher tiers earn larger reward shares.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {[
              {
                tier: "grey" as const,
                range: "0 – 25",
                mult: "0.5x",
                active: false,
              },
              {
                tier: "blue" as const,
                range: "26 – 50",
                mult: "0.75x",
                active: false,
              },
              {
                tier: "green" as const,
                range: "51 – 75",
                mult: "1.0x",
                active: true,
              },
              {
                tier: "gold" as const,
                range: "76 – 100",
                mult: "1.25x",
                active: false,
              },
              {
                tier: "diamond" as const,
                range: "100+",
                mult: "1.5x",
                active: false,
              },
            ].map((b) => (
              <div
                key={b.tier}
                className={cn(
                  "flex flex-col items-center gap-4 rounded-[var(--radius-ok)] border p-6 text-center transition-all",
                  b.active
                    ? "border-ok-green/40 bg-ok-green/5 shadow-[0_0_30px_rgba(20,241,149,0.08)]"
                    : "border-ok-border bg-ok-surface hover:border-ok-green/20"
                )}
              >
                <Badge tier={b.tier} className="text-sm" />
                <div>
                  <p className="font-mono text-xs text-ok-muted">
                    Score {b.range}
                  </p>
                  <p className="mt-1 font-display text-2xl font-bold text-ok-green">
                    {b.mult}
                  </p>
                  <p className="text-[10px] text-ok-muted/60">reward share</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 6. CTA BANNER ──────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-6 py-24">
        <div className="relative overflow-hidden rounded-[var(--radius-ok)] border border-ok-green/20 bg-ok-surface p-10 sm:p-14">
          {/* Subtle green gradient glow behind */}
          <div className="pointer-events-none absolute inset-0 rounded-[var(--radius-ok)] bg-gradient-to-br from-ok-green/5 via-transparent to-ok-purple/5" />

          <div className="relative flex flex-col items-center gap-8 text-center">
            <h2 className="font-display text-3xl font-bold tracking-tight text-ok-text sm:text-4xl">
              Ready to Run a Verified Survey?
            </h2>
            <div className="flex flex-wrap justify-center gap-4">
              <Button variant="primary" size="lg">
                <Wallet className="h-4 w-4" />
                Create Survey — Connect Wallet
              </Button>
              <Button variant="secondary" size="lg">
                Fill a Survey — Browse Forms
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ── 7. FOOTER ──────────────────────────────────────────────────────── */}
      <footer className="border-t border-ok-border">
        <div className="mx-auto max-w-7xl px-6 py-16">
          <div className="grid gap-12 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
            {/* Brand */}
            <div>
              <Link
                to="/"
                className="mb-4 inline-flex items-center gap-2 text-ok-text no-underline"
              >
                <Link2 className="h-5 w-5 text-ok-green" strokeWidth={2.5} />
                <span className="font-display text-lg font-bold tracking-tight">
                  Okaform
                </span>
              </Link>
              <p className="mt-3 max-w-xs text-sm leading-relaxed text-ok-muted">
                Solana-native survey platform. Verified respondents.
                On-chain escrow. Reputation-weighted rewards.
              </p>
            </div>

            {/* Product */}
            <div>
              <h4 className="mb-4 text-xs font-semibold uppercase tracking-widest text-ok-muted/60">
                Product
              </h4>
              <ul className="space-y-2.5">
                {["Features", "Pricing", "Roadmap"].map((link) => (
                  <li key={link}>
                    <Link
                      to={`/${link.toLowerCase()}`}
                      className="text-sm text-ok-muted transition-colors hover:text-ok-text"
                    >
                      {link}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Resources */}
            <div>
              <h4 className="mb-4 text-xs font-semibold uppercase tracking-widest text-ok-muted/60">
                Resources
              </h4>
              <ul className="space-y-2.5">
                {["Docs", "GitHub", "Changelog"].map((link) => (
                  <li key={link}>
                    <Link
                      to={`/${link.toLowerCase()}`}
                      className="text-sm text-ok-muted transition-colors hover:text-ok-text"
                    >
                      {link}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Legal */}
            <div>
              <h4 className="mb-4 text-xs font-semibold uppercase tracking-widest text-ok-muted/60">
                Legal
              </h4>
              <ul className="space-y-2.5">
                {["Privacy", "Terms"].map((link) => (
                  <li key={link}>
                    <Link
                      to={`/${link.toLowerCase()}`}
                      className="text-sm text-ok-muted transition-colors hover:text-ok-text"
                    >
                      {link}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="mt-14 flex flex-col items-center justify-between gap-4 border-t border-ok-border pt-8 sm:flex-row">
            <div className="flex items-center gap-2 text-xs text-ok-muted/60">
              <span className="text-ok-green">◎</span>
              Built on Solana
            </div>
            <p className="text-xs text-ok-muted/60">
              © 2025 Okaform. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default Home;
