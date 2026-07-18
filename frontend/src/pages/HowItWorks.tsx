import {
  Layout,
  Lock,
  Share2,
  BarChart3,
  Wallet,
  ShieldCheck,
  MessageSquare,
  Coins,
  Users,
  Bot,
  ArrowRight,
  ExternalLink,
  ChevronLeft,
} from "lucide-react";
import { Link } from "react-router-dom";
import OkaformLogo from "@/components/OkaformLogo";
import { Badge, Button } from "@/components/okaform";
import { cn } from "@/lib/utils";

interface StepCardProps {
  num: string;
  icon: React.FC<{ className?: string }>;
  title: string;
  body: string;
}

function StepCard({ num, icon: Icon, title, body }: StepCardProps) {
  return (
    <div className="group flex flex-col gap-4 border-t border-[#3D444D] pt-6 transition-colors hover:border-[#F0F6F6]">
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs font-medium text-[#656C76]">
          {num}
        </span>
        <Icon className="h-4 w-4 text-[#9198A1] transition-colors group-hover:text-ok-green" />
      </div>
      <h3 className="text-base font-medium tracking-tight text-[#F0F6F6]">
        {title}
      </h3>
      <p className="text-sm leading-relaxed text-[#9198A1]">
        {body}
      </p>
    </div>
  );
}

export default function HowItWorks() {
  return (
    <div className="min-h-screen bg-[#0D1117] text-[#F0F6F6] selection:bg-ok-green/20">
      {/* ─── NAV ────────────────────────────────────────────────────────────── */}
      <nav className="flex h-16 items-center justify-between border-b border-[#3D444D] bg-[#151B23]/50 px-8 backdrop-blur-md">
        <Link
          to="/"
          className="flex items-center gap-1.5 text-sm font-medium text-[#656C76] transition-colors hover:text-[#F0F6F6]"
        >
          <ChevronLeft className="h-4 w-4" />
          <OkaformLogo height={40} />
        </Link>
        <Link
          to="/create"
          className="font-mono text-xs font-medium text-[#F0F6F6] transition-colors hover:text-ok-green"
        >
          [ Create Survey ]
        </Link>
      </nav>

      {/* ─── HERO ──────────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-4xl px-8 pt-32 pb-24 text-left md:text-center md:pt-40 md:pb-32">
        <span className="mb-4 block font-mono text-xs tracking-wider text-ok-green">
          System Overview
        </span>
        <h1 className="text-4xl font-medium tracking-tight text-[#F0F6F6] md:text-6xl md:leading-[1.15]">
          From broken surveys to verified <span className="text-ok-green">community intelligence</span>
        </h1>
        <p className="mt-6 text-base text-[#9198A1] md:mx-auto md:max-w-2xl md:text-lg">
          Every major Solana protocol has tried running a community survey.
          Every single one has been botted. Here is exactly how we solve it.
        </p>
      </section>

      {/* ─── THE PROBLEM STRIP ────────────────────────────────────────────── */}
      <section className="mx-auto max-w-5xl px-8 pb-32">
        <div className="border-y border-[#3D444D] py-16">
          <div className="grid gap-16 md:grid-cols-2 md:gap-24">
            {/* Left Column */}
            <div className="space-y-8">
              <h2 className="text-xl font-medium tracking-tight text-ok-danger">
                The Legacy Problem
              </h2>
              <div className="space-y-6">
                {[
                  {
                    icon: Bot,
                    text: "Public Google Forms combined with static announcements generate massive bot clusters instantly.",
                  },
                  {
                    icon: Users,
                    text: "Incentive mechanisms are continuously systematically drained by professional Sybil farming operations.",
                  },
                  {
                    icon: BarChart3,
                    text: "Resulting data vectors lack clear signals, making real ecosystem governance impossible.",
                  },
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-4">
                    <item.icon className="mt-1 h-4 w-4 shrink-0 text-[#656C76]" />
                    <p className="text-sm leading-relaxed text-[#9198A1]">
                      {item.text}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Column */}
            <div className="flex flex-col justify-center border-t border-[#3D444D] pt-12 md:border-t-0 md:pt-0">
              <div className="relative mx-auto w-full max-w-sm rounded-lg border border-[#3D444D] bg-[#151B23] p-6 shadow-xl">
                <div className="space-y-3 opacity-30">
                  <div className="h-2.5 w-3/4 rounded bg-[#3D444D]" />
                  <div className="h-2 w-full rounded bg-[#3D444D]/60" />
                  <div className="h-2 w-5/6 rounded bg-[#3D444D]/60" />
                </div>
                <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-[#0D1117]/90 backdrop-blur-sm">
                  <div className="flex items-center gap-3 rounded border border-ok-danger/30 bg-ok-danger/5 px-4 py-2">
                    <Bot className="h-4 w-4 text-ok-danger" />
                    <span className="font-mono text-xs font-medium tracking-wide text-ok-danger uppercase">
                      Sybil Signature Intercepted
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── CREATOR JOURNEY ──────────────────────────────────────────────── */}
      <section className="mx-auto max-w-5xl px-8 pb-32">
        <div className="mb-16">
          <h2 className="text-2xl font-medium tracking-tight text-[#F0F6F6] sm:text-3xl">
            For Protocols &amp; DAOs
          </h2>
          <p className="mt-2 font-mono text-xs text-[#656C76]">
            Deploy cryptographically sound intelligence campaigns
          </p>
        </div>

        <div className="grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
          <StepCard
            num="01"
            icon={Layout}
            title="Configure Parameters"
            body="Construct targeting nodes based on verifiable criteria: wallet account age, structural SOL benchmarks, or historical governance activity."
          />
          <StepCard
            num="02"
            icon={Lock}
            title="Escrow Rewards"
            body="Lock allocation vectors into clean, isolated program-derived addresses. Funds settle programmatically on confirmation triggers."
          />
          <StepCard
            num="03"
            icon={Share2}
            title="Secure Distribution"
            body="Distribute single access signatures across communications infrastructure. The protocol handles eligibility gating instantly."
          />
          <StepCard
            num="04"
            icon={BarChart3}
            title="Isolate High Signal"
            body="Review responses cross-referenced against historical on-chain metrics, ensuring maximum clarity for dataset processing."
          />
        </div>
      </section>

      {/* ─── RESPONDENT JOURNEY ────────────────────────────────────────────── */}
      <section className="mx-auto max-w-5xl px-8 pb-32">
        <div className="mb-16 border-t border-[#3D444D] pt-16">
          <h2 className="text-2xl font-medium tracking-tight text-[#F0F6F6] sm:text-3xl">
            For Ecosystem Users
          </h2>
          <p className="mt-2 font-mono text-xs text-[#656C76]">
            Monetize verified workspace attention
          </p>
        </div>

        <div className="grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
          <StepCard
            num="01"
            icon={Wallet}
            title="Cryptographic Login"
            body="Authenticate directly using active wallet handshakes. Zero tracking layers, transient cookies, or persistent database accounts."
          />
          <StepCard
            num="02"
            icon={ShieldCheck}
            title="State Verification"
            body="Verify eligibility parameters instantaneously over local node pipelines before question schemas ever download."
          />
          <StepCard
            num="03"
            icon={MessageSquare}
            title="Contribute Feedback"
            body="Provide direct, long-form qualitative insight to systematically elevate your network reputation weight across campaigns."
          />
          <StepCard
            num="04"
            icon={DirectSettlement}
            title="Direct Settlement"
            body="Funds clear straight into balance addresses instantly when closing algorithms complete execution loops."
          />
        </div>
      </section>

      {/* ─── REPUTATION SYSTEM ────────────────────────────────────────────── */}
      <section className="mx-auto max-w-5xl px-8 pb-32">
        <div className="border-y border-[#3D444D] py-16">
          <div className="max-w-2xl space-y-4 mb-16">
            <h2 className="text-2xl font-medium tracking-tight text-[#F0F6F6] sm:text-3xl">
              Portable On-Chain Reputation
            </h2>
            <p className="text-sm leading-relaxed text-[#9198A1]">
              Consistent platform utility mutates a sovereign scorecard held on-chain. This structural registry accounts for participant quality and scales payout allocation yields.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 lg:grid-cols-5">
            {[
              { tier: "grey" as const, range: "0 – 25", mult: "0.5x", active: false },
              { tier: "blue" as const, range: "26 – 50", mult: "0.75x", active: false },
              { tier: "green" as const, range: "51 – 75", mult: "1.0x", active: true },
              { tier: "gold" as const, range: "76 – 100", mult: "1.25x", active: false },
              { tier: "diamond" as const, range: "100+", mult: "1.5x", active: false },
            ].map((b) => (
              <div
                key={b.tier}
                className={cn(
                  "flex flex-col items-start gap-4 border-t pt-6 transition-colors",
                  b.active
                    ? "border-ok-green"
                    : "border-[#3D444D] hover:border-[#9198A1]"
                )}
              >
                <Badge tier={b.tier} className="text-xs" />
                <div className="space-y-1">
                  <p className="font-mono text-xs text-[#656C76]">
                    Score {b.range}
                  </p>
                  <p className="text-2xl font-medium tracking-tight text-[#F0F6F6]">
                    {b.mult} <span className="text-xs font-normal text-[#656C76]">yield</span>
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── TRUST SECTION ────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-5xl px-8 pb-32">
        <div className="grid gap-12 md:grid-cols-3 md:gap-16">
          <div className="space-y-4">
            <Lock className="h-5 w-5 text-ok-green" />
            <h3 className="text-base font-medium tracking-tight text-[#F0F6F6]">
              Immutable Escrow
            </h3>
            <p className="text-sm leading-relaxed text-[#9198A1]">
              Capital parameters exist completely separated inside isolated programmatic state vectors, entirely independent of manual operator controls.
            </p>
          </div>

          <div className="space-y-4">
            <Users className="h-5 w-5 text-ok-purple" />
            <h3 className="text-base font-medium tracking-tight text-[#F0F6F6]">
              Non-Custodial Architecture
            </h3>
            <p className="text-sm leading-relaxed text-[#9198A1]">
              Assets route automatically along on-chain settlement channels directly to destination keys. Middlewares never touch or process allocations.
            </p>
          </div>

          <div className="space-y-4">
            <ExternalLink className="h-5 w-5 text-ok-green" />
            <h3 className="text-base font-medium tracking-tight text-[#F0F6F6]">
              Total Auditability
            </h3>
            <p className="text-sm leading-relaxed text-[#9198A1]">
              State initialization metrics and target vectors update openly to standard cluster accounts for immediate structural validation.
            </p>
          </div>
        </div>
      </section>

      {/* ─── FINAL CTA ────────────────────────────────────────────────────── */}
      <section className="border-t border-[#3D444D] bg-[#151B23]/30 px-8 py-24 text-center">
        <h2 className="text-2xl font-medium tracking-tight text-[#F0F6F6] sm:text-4xl">
          Initialize your first verification run.
        </h2>
        <div className="mt-10 flex flex-col items-center justify-center gap-6 sm:flex-row">
          <Link to="/create">
            <Button variant="primary" size="lg" className="w-full sm:w-auto">
              Launch Creator App
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
          <Link to="/" className="font-mono text-xs text-[#656C76] transition-colors hover:text-[#F0F6F6]">
            [ Read Interface Specs ]
          </Link>
        </div>
      </section>
    </div>
  );
}

// Fallback micro icon for clear visualization
function DirectSettlement({ className }: { className?: string }) {
  return <Coins className={className} />;
}