import { Link } from "react-router-dom";
import {
  Link2,
  Wallet,
  ShieldCheck,
  BarChart3,
  Lock,
  Database,
  ArrowRight,
  Terminal,
  Users,
  Zap,
  ChevronRight,
} from "lucide-react";

import { Badge, StatusPill, SOLAmount } from "@/components/okaform";
import { cn } from "@/lib/utils";

/* ──────────────────────────────────────────────────────────────────────────────
   Landing page — Refactored to match the GitHub/Technical aesthetic.
   ────────────────────────────────────────────────────────────────────────────── */

function Home() {
  return (
    <div className="min-h-screen bg-[#0D1117] text-[#F0F6F6] selection:bg-ok-green/20">
      {/* ── 1. HERO ────────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-5xl px-8 pt-20 pb-24 lg:pt-28 lg:pb-32">
        <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
          {/* Left — copy */}
          <div className="flex flex-col gap-8">
            {/* Eyebrow */}
            <div className="flex items-center gap-2.5">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ok-purple opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-ok-purple" />
              </span>
              <span className="font-mono text-[10px] font-medium tracking-widest text-ok-purple uppercase">
                [ Protocol Active on Solana ]
              </span>
            </div>

            {/* Headline */}
            <h1 className="text-4xl font-medium leading-[1.15] tracking-tight text-[#F0F6F6] sm:text-5xl lg:text-[3.5rem]">
              Your Community's Opinions,{" "}
              <span className="text-ok-green">Verified On-Chain</span>
            </h1>

            {/* Subheadline */}
            <p className="max-w-lg text-sm leading-relaxed text-[#9198A1] lg:text-base">
              Launch incentivised surveys for your DAO or protocol.
              Bot-proof. Reputation-weighted. Automatically distributed through cryptographically secure escrow.
            </p>

            {/* CTAs */}
            <div className="flex flex-wrap items-center gap-4">
              <Link 
                to="/create" 
                className="inline-flex h-10 items-center justify-center gap-2 rounded bg-ok-green px-6 font-mono text-xs font-bold uppercase tracking-wide text-[#0D1117] transition-colors hover:bg-ok-green/90"
              >
                Initialize Survey
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link 
                to="/dashboard" 
                className="inline-flex h-10 items-center justify-center gap-2 rounded border border-[#3D444D] bg-[#151B23] px-6 font-mono text-xs font-bold uppercase tracking-wide text-[#F0F6F6] transition-colors hover:border-[#656C76] hover:bg-[#0D1117]"
              >
                Explore Surveys
              </Link>
            </div>
          </div>

          {/* Right — floating mockup card */}
          <div className="hidden lg:block">
            <div className="rounded border border-[#3D444D] bg-[#151B23] p-1 shadow-2xl">
              <div className="rounded-sm border border-[#3D444D]/50 bg-[#0D1117] p-6">
                {/* Card header */}
                <div className="mb-6 flex items-start justify-between border-b border-[#3D444D] pb-4">
                  <div>
                    <h3 className="text-base font-medium text-[#F0F6F6]">
                      Jupiter Community Pulse
                    </h3>
                    <p className="mt-1 font-mono text-[10px] text-[#656C76] uppercase tracking-wider">
                      Q2 2025 Governance Feedback
                    </p>
                  </div>
                  <StatusPill status="active" />
                </div>

                {/* Reward pool */}
                <div className="mb-6 flex items-center justify-between rounded border border-[#3D444D] bg-[#151B23] p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded bg-ok-green/10">
                      <span className="font-mono text-sm text-ok-green">◎</span>
                    </div>
                    <div>
                      <p className="font-mono text-[10px] text-[#9198A1] uppercase tracking-wider">Locked Escrow</p>
                      <SOLAmount amount={50} unit="sol" className="font-mono text-sm font-medium text-[#F0F6F6]" />
                    </div>
                  </div>
                </div>

                {/* Response bar */}
                <div className="mb-6">
                  <div className="mb-2 flex items-center justify-between font-mono text-[10px]">
                    <span className="text-[#9198A1] uppercase tracking-wider">Data Vectors</span>
                    <span className="text-[#F0F6F6]">234 / 500 (46.8%)</span>
                  </div>
                  <div className="h-1 overflow-hidden rounded-full bg-[#3D444D]">
                    <div
                      className="h-full bg-ok-green transition-all"
                      style={{ width: "46.8%" }}
                    />
                  </div>
                </div>

                {/* Respondent rows */}
                <div className="space-y-0 text-sm">
                  <div className="font-mono text-[10px] text-[#656C76] uppercase tracking-wider border-b border-[#3D444D] pb-2 mb-2">
                    Recent Verified Signatures
                  </div>
                  {[
                    { wallet: "7xKp...3mQr", tier: "diamond" as const },
                    { wallet: "9Yn2...8kLm", tier: "gold" as const },
                    { wallet: "4Vb1...6xNf", tier: "green" as const },
                  ].map((r) => (
                    <div
                      key={r.wallet}
                      className="flex items-center justify-between border-b border-[#3D444D]/50 py-2.5 last:border-0 hover:bg-[#151B23]/50 transition-colors px-2 -mx-2 rounded"
                    >
                      <span className="flex items-center gap-2 font-mono text-[11px] text-[#9198A1]">
                        <Wallet className="h-3 w-3 text-ok-green/60" />
                        {r.wallet}
                      </span>
                      <Badge tier={r.tier} className="scale-90 origin-right" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 3. HOW IT WORKS ────────────────────────────────────────────────── */}
      <section id="how-it-works" className="border-t border-[#3D444D] bg-[#151B23]/30">
        <div className="mx-auto max-w-5xl px-8 py-24">
          <div className="mb-12 max-w-2xl">
            <h2 className="text-2xl font-medium tracking-tight text-[#F0F6F6] sm:text-3xl">
              Execution Pipeline
            </h2>
            <p className="mt-2 text-sm text-[#9198A1]">
              Three deterministic steps from survey instantiation to on-chain distribution.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {[
              {
                num: "01",
                icon: <Terminal className="h-5 w-5" />,
                title: "Initialize Escrow",
                desc: "Lock SOL natively, configure respondent parameters: wallet age thresholds, token balances, and SPL holdings.",
                role: "Deployer",
              },
              {
                num: "02",
                icon: <Users className="h-5 w-5" />,
                title: "Sybil Filtered Responses",
                desc: "Wallet-gated and reputation-scored ingestion. Hardware-verified humans only. Cryptographically clean data.",
                role: "Nodes",
              },
              {
                num: "03",
                icon: <Zap className="h-5 w-5" />,
                title: "Automated Resolution",
                desc: "Funds pushed automatically weighted by reputation tier. Zero manual execution. Immutable settlement.",
                role: "Smart Contract",
              },
            ].map((step) => (
              <div key={step.num} className="group relative rounded border border-[#3D444D] bg-[#0D1117] p-8 hover:border-[#656C76] transition-colors">
                <div className="mb-6 flex items-center justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded border border-[#3D444D] bg-[#151B23] text-ok-green">
                    {step.icon}
                  </div>
                  <span className="font-mono text-2xl font-bold text-[#3D444D] transition-colors group-hover:text-ok-green/20">
                    {step.num}
                  </span>
                </div>
                <span className="mb-2 block font-mono text-[10px] font-medium uppercase tracking-widest text-ok-purple">
                  [ {step.role} ]
                </span>
                <h3 className="mb-2 text-base font-medium text-[#F0F6F6]">
                  {step.title}
                </h3>
                <p className="text-xs leading-relaxed text-[#9198A1]">
                  {step.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 4. FEATURES GRID ──────────────────────────────────────────────── */}
      <section className="mx-auto max-w-5xl px-8 py-24">
        <div className="mb-12 max-w-2xl">
          <h2 className="text-2xl font-medium tracking-tight text-[#F0F6F6] sm:text-3xl">
            Built for Distributed Ledgers
          </h2>
          <p className="mt-2 text-sm text-[#9198A1]">
            Architected specifically around verifiable identity and zero-trust distribution.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Card 1 */}
          <div className="rounded border border-[#3D444D] bg-[#151B23] p-8 md:col-span-2 md:row-span-1">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded border border-[#3D444D] bg-[#0D1117]">
                <ShieldCheck className="h-5 w-5 text-ok-green" />
              </div>
              <div>
                <h3 className="mb-2 text-base font-medium text-[#F0F6F6]">
                  Sybil Resistant Infrastructure
                </h3>
                <p className="text-sm leading-relaxed text-[#9198A1]">
                  Wallet age metrics, minimum SOL balances, and advanced funding-graph analysis filter programmatic bots before a single data point is ingested. Every respondent maps to a verified human actor with an established on-chain history.
                </p>
              </div>
            </div>
          </div>

          {/* Card 2 */}
          <div className="rounded border border-[#3D444D] bg-[#151B23] p-8">
            <div className="mb-5 flex h-10 w-10 items-center justify-center rounded border border-[#3D444D] bg-[#0D1117]">
              <BarChart3 className="h-4 w-4 text-ok-purple" />
            </div>
            <h3 className="mb-2 text-base font-medium text-[#F0F6F6]">
              Deterministic Reputation
            </h3>
            <p className="text-xs leading-relaxed text-[#9198A1]">
              Entities build global on-chain scores across all forms. Tiers dictate reward weightings (Ghost → Cipher → Sentinel → Oracle → Sovereign).
            </p>
          </div>

          {/* Card 3 */}
          <div className="rounded border border-[#3D444D] bg-[#151B23] p-8">
            <div className="mb-5 flex h-10 w-10 items-center justify-center rounded border border-[#3D444D] bg-[#0D1117]">
              <Lock className="h-4 w-4 text-ok-green" />
            </div>
            <h3 className="mb-2 text-base font-medium text-[#F0F6F6]">
              PDA Escrow Control
            </h3>
            <p className="text-xs leading-relaxed text-[#9198A1]">
              Reward pools lock into Solana Program Derived Addresses. Distribution executes automatically upon closure. Zero counter-party trust.
            </p>
          </div>

          {/* Card 4 */}
          <div className="rounded border border-[#3D444D] bg-[#151B23] p-8 md:col-span-2 md:row-span-1">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded border border-[#3D444D] bg-[#0D1117]">
                <Database className="h-5 w-5 text-ok-green" />
              </div>
              <div>
                <h3 className="mb-2 text-base font-medium text-[#F0F6F6]">
                  Cryptographically Clean Data
                </h3>
                <p className="text-sm leading-relaxed text-[#9198A1]">
                  Incoming responses are signed by verified entities. Every vector is tagged with a reputation hash. Farm mitigation natively active. Discard duplicate nodes. Export data you can definitively use for protocol governance.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 5. BADGE TIERS ─────────────────────────────────────────────────── */}
      <section className="border-t border-[#3D444D] bg-[#151B23]/30">
        <div className="mx-auto max-w-5xl px-8 py-24">
          <div className="mb-12 text-center">
            <h2 className="text-2xl font-medium tracking-tight text-[#F0F6F6] sm:text-3xl">
              Yield Multipliers
            </h2>
            <p className="mx-auto mt-2 max-w-xl text-sm text-[#9198A1]">
              Reputation scores compound with data quality. Higher tier classifications map directly to larger algorithmic payout shares.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {[
              {
                tier: "grey" as const,
                range: "000 – 025",
                mult: "0.5x",
                active: false,
              },
              {
                tier: "blue" as const,
                range: "026 – 050",
                mult: "0.75x",
                active: false,
              },
              {
                tier: "green" as const,
                range: "051 – 075",
                mult: "1.00x",
                active: true,
              },
              {
                tier: "gold" as const,
                range: "076 – 100",
                mult: "1.25x",
                active: false,
              },
              {
                tier: "diamond" as const,
                range: "100+",
                mult: "1.50x",
                active: false,
              },
            ].map((b) => (
              <div
                key={b.tier}
                className={cn(
                  "flex flex-col items-center gap-4 rounded border p-6 text-center transition-all",
                  b.active
                    ? "border-ok-green bg-ok-green/5"
                    : "border-[#3D444D] bg-[#0D1117] hover:border-[#656C76]"
                )}
              >
                <Badge tier={b.tier} className="text-sm" />
                <div>
                  <p className="font-mono text-[10px] text-[#656C76] uppercase tracking-wider">
                    Score {b.range}
                  </p>
                  <p className="mt-1.5 font-mono text-xl font-medium text-ok-green">
                    {b.mult}
                  </p>
                  <p className="text-[9px] font-mono text-[#656C76] uppercase tracking-wider">Payout Weight</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 6. CTA BANNER ──────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-5xl px-8 py-24">
        <div className="relative overflow-hidden rounded border border-ok-green/30 bg-[#151B23] p-10 sm:p-14 text-center">
          <h2 className="mb-6 text-2xl font-medium tracking-tight text-[#F0F6F6] sm:text-3xl">
            Initialize Verified Survey Node
          </h2>
          <div className="flex flex-wrap justify-center gap-4">
              <Link 
                to="/create" 
                className="inline-flex h-10 items-center justify-center gap-2 rounded bg-ok-green px-6 font-mono text-xs font-bold uppercase tracking-wide text-[#0D1117] transition-colors hover:bg-ok-green/90"
              >
                Create a Survey
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            <Link 
              to="/dashboard" 
              className="inline-flex h-10 items-center justify-center gap-2 rounded border border-[#3D444D] bg-[#0D1117] px-6 font-mono text-xs font-bold uppercase tracking-wide text-[#F0F6F6] transition-colors hover:border-[#656C76]"
            >
              Access Public Forms
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── 7. FOOTER ──────────────────────────────────────────────────────── */}
      <footer className="border-t border-[#3D444D] bg-[#0D1117]">
        <div className="mx-auto max-w-5xl px-8 py-16">
          <div className="grid gap-12 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
            {/* Brand */}
            <div>
              <Link
                to="/"
                className="mb-4 inline-flex items-center gap-2 text-[#F0F6F6] no-underline transition-colors hover:text-ok-green"
              >
                <Link2 className="h-5 w-5 text-ok-green" strokeWidth={2.5} />
                <span className="font-mono text-sm font-bold tracking-tight">
                  Okaform
                </span>
              </Link>
              <p className="mt-3 max-w-xs text-xs leading-relaxed text-[#9198A1]">
                Solana-native survey consensus protocol. Cryptographically verified respondents.
                Automated on-chain escrow. Reputation-weighted distribution.
              </p>
            </div>

            {/* Links Structure */}
            {[
              { title: "Protocol", links: ["Architecture", "Parameters", "Upgrades"] },
              { title: "Resources", links: ["Documentation", "GitHub", "Audits"] },
              { title: "Legal", links: ["Privacy Policy", "Terms of Service"] },
            ].map((section) => (
              <div key={section.title}>
                <h4 className="mb-4 font-mono text-[10px] font-semibold uppercase tracking-widest text-[#656C76]">
                  {section.title}
                </h4>
                <ul className="space-y-3">
                  {section.links.map((link) => (
                    <li key={link}>
                      <Link
                        to={`/${link.toLowerCase().replace(" ", "-")}`}
                        className="text-xs text-[#9198A1] transition-colors hover:text-[#F0F6F6]"
                      >
                        {link}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Bottom bar */}
          <div className="mt-16 flex flex-col items-center justify-between gap-4 border-t border-[#3D444D]/40 pt-8 sm:flex-row">
            <div className="flex items-center gap-2 font-mono text-[10px] text-[#656C76] uppercase tracking-wider">
              <span className="text-ok-green">◎</span>
              Executing on Solana Mainnet
            </div>
            <p className="font-mono text-[10px] text-[#656C76] uppercase tracking-wider">
              © {new Date().getFullYear()} Okaform Protocol. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default Home;
