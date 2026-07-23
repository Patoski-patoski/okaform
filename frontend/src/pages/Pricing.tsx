import { useState } from "react";
import {
  ArrowRight,
  CheckCircle,
  ChevronDown,
  Coins,
  Sparkles,
  Shield,
  Lock,
  Zap,
  Server,
  Sliders,
  Database,
} from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

interface TierMetric {
  label: string;
  value: string;
}

const TIERS = [
  {
    id: "open",
    nodeName: "OPEN-01",
    tag: "Permissionless",
    fee: "5%",
    feeLabel: "of reward pool",
    description: "Any valid wallet can respond. Basic sybil protection included.",
    metrics: [
      { label: "Filter Layer", value: "Standard" },
      { label: "Response Cap", value: "Unlimited" },
      { label: "Distribution", value: "Reputation-Weighted" },
    ],
    features: [
      "On-chain escrow",
      "Reputation-weighted distribution",
      "Lottery mode toggle",
      "Wallet age verification",
      "SOL balance check",
      "Response depth scoring",
      "CSV export",
      "Creator dashboard",
    ],
    cta: "[ Initialize ]",
    variant: "standard" as const,
  },
  {
    id: "filtered",
    nodeName: "FILTER-02",
    tag: "Most Popular",
    fee: "5% + $15",
    feeLabel: "flat filter fee at creation",
    description: "Wallet age + SOL balance gating. Advanced bot detection.",
    metrics: [
      { label: "Filter Layer", value: "Advanced" },
      { label: "Bot Detection", value: "Funding-Graph" },
      { label: "Distribution", value: "Priority Matched" },
    ],
    features: [
      "Everything in Open",
      "Minimum wallet age filter",
      "Minimum SOL balance filter",
      "Funding-graph bot detection",
      "Answer similarity flagging",
      "Priority respondent matching",
    ],
    cta: "[ Deploy ]",
    variant: "accent" as const,
  },
  {
    id: "targeted",
    nodeName: "TARGET-03",
    tag: "Enterprise",
    fee: "5% + $30–100",
    feeLabel: "based on targeting complexity",
    description: "Token holdings, NFT membership, DAO participation gates.",
    metrics: [
      { label: "Filter Layer", value: "Custom" },
      { label: "Token Gates", value: "SPL / NFT / DAO" },
      { label: "Distribution", value: "Multi-Criteria" },
    ],
    features: [
      "Everything in Filtered",
      { text: "Single token holding gate", soon: false },
      { text: "Token threshold gate", soon: false },
      { text: "Multi-criteria combinations", soon: false },
      { text: "NFT collection membership", soon: true },
      { text: "DAO participation gate", soon: true },
    ],
    cta: "[ Configure ]",
    variant: "terminal" as const,
  },
] as const;

const TARGETING_FEES = [
  { label: "Single token holding", example: "e.g. holds any JUP", cost: "+$30" },
  { label: "Token threshold", example: "e.g. JUP ≥ 50", cost: "+$40–60" },
  { label: "Multi-criteria combined", example: "", cost: "+$60–100" },
  { label: "NFT collection membership", example: "", cost: "+$50–75" },
];

const FAQ_ITEMS = [
  {
    q: "When exactly is the fee charged?",
    a: "At survey creation, when the creator approves the escrow transaction. The fee transfers to Okaform's treasury PDA in the same transaction.",
  },
  {
    q: "What if I close my survey early with fewer responses?",
    a: "The protocol fee is non-refundable. The unspent reward pool returns to your wallet.",
  },
  {
    q: "Can I change the reward pool after publishing?",
    a: "No. The pool is locked in an on-chain escrow PDA at creation. This is what makes the rewards trustless — not even Okaform can change them.",
  },
  {
    q: "Are fees charged in SOL or USD?",
    a: "Protocol fees (%) are charged in SOL. Flat filter fees are denominated in USD but paid in SOL at the current rate.",
  },
  {
    q: "Is there a free tier?",
    a: "There is no free tier — but there is no subscription either. You only pay when you publish a survey with a reward pool. Browsing, exploring, and filling surveys is always free.",
  },
];

function FlowDiagram() {
  const steps = [
    { label: "Creator deposits 10 SOL", icon: Coins },
    { label: "5% fee → Okaform Treasury", icon: null },
    { label: "9.5 SOL locked in escrow PDA", icon: null },
    { label: "Respondents earn", icon: Sparkles },
  ];

  return (
    <div className="flex items-center justify-center gap-2 py-6">
      {steps.map((step, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 rounded border border-[#3D444D] bg-[#0D1117] px-3 py-1.5 text-xs text-[#F0F6F6]">
            {step.icon && <step.icon className="h-3 w-3 text-ok-green" />}
            <span>{step.label}</span>
          </div>
          {i < steps.length - 1 && (
            <ArrowRight className="h-3 w-3 shrink-0 text-ok-green" />
          )}
        </div>
      ))}
    </div>
  );
}

function FeeCalculator() {
  const [rewardPool, setRewardPool] = useState(10);
  const [tier, setTier] = useState<"open" | "filtered" | "targeted">("open");
  const [maxResponses, setMaxResponses] = useState(100);

  const protocolFee = rewardPool * 0.05;
  const filterFee = tier === "open" ? 0 : tier === "filtered" ? 15 : 65;
  const filterFeeSol = filterFee / 150;
  const escrowed = Math.max(0, rewardPool - protocolFee - filterFeeSol);
  const perRespondent = maxResponses > 0 ? escrowed / maxResponses : 0;

  return (
    <div className="relative overflow-hidden rounded border border-[#3D444D] bg-[#151B23]/40">
      {/* Decorative corner */}
      <div className="absolute right-0 top-0 h-12 w-12 opacity-10"
           style={{ backgroundImage: 'linear-gradient(225deg, transparent 50%, #14F195 50%)' }} />

      <div className="p-6 md:p-8">
        <div className="mb-6 flex items-center gap-2 border-b border-[#3D444D]/50 pb-4">
          <Server className="h-4 w-4 text-ok-green" />
          <span className="font-mono text-xs text-[#656C76]">SYS // COST CALCULATOR</span>
        </div>

        <div className="mb-8 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-2 block font-mono text-[10px] tracking-widest text-[#656C76] uppercase">
              Reward pool (SOL)
            </label>
            <input
              type="number"
              min={0.1}
              step={0.1}
              value={rewardPool}
              onChange={(e) => setRewardPool(Number(e.target.value) || 0)}
              className="w-full rounded border border-[#3D444D] bg-[#0D1117]/60 px-4 py-3 font-mono text-sm text-[#F0F6F6] outline-none transition-colors focus:border-ok-green/50 focus:ring-1 focus:ring-ok-green/30"
            />
          </div>
          <div>
            <label className="mb-2 block font-mono text-[10px] tracking-widest text-[#656C76] uppercase">
              Max responses
            </label>
            <input
              type="number"
              min={1}
              step={1}
              value={maxResponses}
              onChange={(e) => setMaxResponses(Number(e.target.value) || 1)}
              className="w-full rounded border border-[#3D444D] bg-[#0D1117]/60 px-4 py-3 font-mono text-sm text-[#F0F6F6] outline-none transition-colors focus:border-ok-green/50 focus:ring-1 focus:ring-ok-green/30"
            />
          </div>
        </div>

        <div className="mb-8">
          <label className="mb-2 block font-mono text-[10px] tracking-widest text-[#656C76] uppercase">
            Tier
          </label>
          <div className="flex gap-2">
            {(["open", "filtered", "targeted"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTier(t)}
                className={cn(
                  "rounded px-4 py-2 font-mono text-xs transition-all",
                  tier === t
                    ? "bg-ok-green/10 border border-ok-green/30 text-ok-green"
                    : "border border-[#3D444D] text-[#656C76] hover:text-[#9198A1]"
                )}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded border border-[#3D444D]/50 bg-[#0D1117]/60 p-4">
            <span className="block font-mono text-[10px] text-[#656C76] uppercase tracking-wider">
              Protocol fee
            </span>
            <span className="mt-1 block font-mono text-2xl font-semibold text-ok-green">
              {protocolFee.toFixed(2)} <span className="text-xs text-[#656C76]">SOL</span>
            </span>
          </div>
          {filterFee > 0 && (
            <div className="rounded border border-[#3D444D]/50 bg-[#0D1117]/60 p-4">
              <span className="block font-mono text-[10px] text-[#656C76] uppercase tracking-wider">
                Filter fee
              </span>
              <span className="mt-1 block font-mono text-2xl font-semibold text-ok-green">
                ${filterFee}
              </span>
            </div>
          )}
          <div className="rounded border border-ok-green/30 bg-[#0D1117]/60 p-4">
            <span className="block font-mono text-[10px] text-[#656C76] uppercase tracking-wider">
              Escrowed for respondents
            </span>
            <span className="mt-1 block font-mono text-2xl font-semibold text-ok-green">
              {escrowed.toFixed(2)} <span className="text-xs text-[#656C76]">SOL</span>
            </span>
          </div>
          <div className="rounded border border-[#3D444D]/50 bg-[#0D1117]/60 p-4">
            <span className="block font-mono text-[10px] text-[#656C76] uppercase tracking-wider">
              Est. per-respondent earnings
            </span>
            <span className="mt-1 block font-mono text-2xl font-semibold text-ok-green">
              {perRespondent.toFixed(4)} <span className="text-xs text-[#656C76]">SOL</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Pricing() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div className="bg-[#0D1117] text-[#F0F6F6] selection:bg-ok-green/20">
      {/* ─── PAGE HEADER ──────────────────────────────────────────────── */}
      <section className="mx-auto max-w-4xl px-8 pt-20 pb-16 text-center">
        <div className="mb-6 inline-flex items-center gap-2 rounded border border-[#3D444D] bg-[#151B23]/50 px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-[#9198A1]">
          <Sliders className="h-3 w-3 text-ok-green" />
          FEE STRUCTURE
        </div>

        <h1 className="text-4xl font-semibold tracking-tight text-[#F0F6F6] sm:text-5xl">
          Simple fees. <span className="text-ok-green">No subscriptions.</span>
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-[#9198A1]">
          Okaform charges a protocol fee on reward pools only.
          You pay when value flows — not before.
        </p>
      </section>

      {/* ─── PRICING MODEL EXPLAINER ─────────────────────────────────── */}
      <section className="mx-auto max-w-4xl px-8 pb-24">
        <div className="relative overflow-hidden rounded border border-[#3D444D] bg-[#151B23]/40">
          {/* Decorative corner */}
          <div className="absolute right-0 top-0 h-12 w-12 opacity-10"
               style={{ backgroundImage: 'linear-gradient(225deg, transparent 50%, #14F195 50%)' }} />

          <div className="border-l-[3px] border-l-ok-green p-6 md:p-10">
            <div className="mb-4 flex items-center gap-2">
              <Lock className="h-4 w-4 text-ok-green" />
              <span className="font-mono text-[10px] text-[#656C76] uppercase tracking-wider">Fee Architecture</span>
            </div>
            <h2 className="mb-4 text-xl font-medium tracking-tight text-[#F0F6F6]">
              How our fee works
            </h2>
            <p className="mb-6 max-w-2xl text-sm leading-relaxed text-[#9198A1]">
              When a creator publishes a survey with a 10 SOL reward pool, Okaform
              deducts a 5% protocol fee (0.5 SOL) at creation. The remaining 9.5 SOL
              locks in on-chain escrow and distributes automatically to respondents
              when the survey closes.
            </p>
            <FlowDiagram />
          </div>
        </div>
      </section>

      {/* ─── TIER TABLE ───────────────────────────────────────────────── */}
      <section className="mx-auto max-w-5xl px-8 pb-24">
        <div className="grid gap-6 md:grid-cols-3">
          {TIERS.map((tier) => {
            const isMostPopular = tier.variant === "accent";
            return (
              <div
                key={tier.id}
                className={cn(
                  "group relative flex flex-col justify-between overflow-hidden rounded border bg-[#151B23]/40 transition-all",
                  isMostPopular
                    ? "border-ok-green/40 shadow-[0_0_30px_rgba(20,241,149,0.04)] bg-[#151B23]/80"
                    : "border-[#3D444D] hover:border-[#656C76]/60"
                )}
              >
                {/* Decorative corner */}
                <div className="absolute right-0 top-0 h-10 w-10 opacity-10 transition-opacity group-hover:opacity-20"
                     style={{ backgroundImage: isMostPopular ? 'linear-gradient(225deg, transparent 50%, #14F195 50%)' : 'linear-gradient(225deg, transparent 50%, #3D444D 50%)' }} />

                <div className="p-6">
                  {/* Tier header */}
                  <div className="mb-6 flex items-center justify-between border-b border-[#3D444D]/50 pb-3">
                    <span className="font-mono text-[10px] text-[#656C76]">
                      SYS // {tier.nodeName}
                    </span>
                    <span className={cn(
                      "rounded border px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider",
                      isMostPopular
                        ? "text-ok-green border-ok-green/20 bg-ok-green/5"
                        : tier.variant === "terminal"
                          ? "text-ok-purple border-ok-purple/20 bg-ok-purple/5"
                          : "text-[#656C76] border-[#3D444D] bg-[#151B23]/40"
                    )}>
                      {tier.tag}
                    </span>
                  </div>

                  {/* Price */}
                  <div className="space-y-1">
                    <div className="flex items-baseline gap-1.5">
                      <span className="font-mono text-3xl font-semibold tracking-tight text-[#F0F6F6]">
                        {tier.fee}
                      </span>
                    </div>
                    <p className="font-mono text-[11px] text-[#656C76]">{tier.feeLabel}</p>
                  </div>

                  <p className="mt-4 text-xs leading-relaxed text-[#9198A1]">
                    {tier.description}
                  </p>

                  {/* System metrics */}
                  <div className="my-6 space-y-2 rounded border border-[#3D444D]/50 bg-[#0D1117]/60 p-3">
                    {tier.metrics.map((m: TierMetric, idx: number) => (
                      <div key={idx} className="flex items-center justify-between font-mono text-[10px]">
                        <span className="text-[#656C76] uppercase">{m.label}:</span>
                        <span className="text-[#F0F6F6] font-medium">{m.value}</span>
                      </div>
                    ))}
                  </div>

                  {/* Features */}
                  <div className="space-y-3 pt-2">
                    <span className="block font-mono text-[9px] uppercase tracking-widest text-[#656C76]">
                      Capabilities
                    </span>
                    <ul className="space-y-2.5 text-xs text-[#9198A1]">
                      {tier.features.map((f, i) => {
                        const isObject = typeof f === "object";
                        const text = isObject ? f.text : f;
                        const soon = isObject ? f.soon : false;
                        return (
                          <li key={i} className="flex items-start gap-2.5">
                            <CheckCircle className="h-3.5 w-3.5 shrink-0 text-ok-green" />
                            <span className={soon ? "text-[#656C76]" : ""}>{text}</span>
                            {soon && (
                              <span className="ml-auto shrink-0 rounded border border-[#3D444D] bg-[#0D1117] px-1.5 py-0.5 font-mono text-[9px] text-[#656C76]">
                                Soon
                              </span>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </div>

                {/* CTA */}
                <div className="mt-auto border-t border-[#3D444D]/40 p-6 pt-4">
                  <Link to="/create">
                    <button
                      className={cn(
                        "w-full rounded font-mono text-xs py-2.5 transition-all flex items-center justify-center gap-2",
                        isMostPopular
                          ? "bg-ok-green text-[#0D1117] font-semibold hover:bg-[#10C97A] hover:shadow-[0_0_15px_rgba(20,241,149,0.2)]"
                          : "border border-[#3D444D] text-[#9198A1] hover:border-[#656C76] hover:text-[#F0F6F6] bg-[#0D1117]/60"
                      )}
                    >
                      {tier.cta}
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ─── TARGETING FEE BREAKDOWN ──────────────────────────────────── */}
      <section className="mx-auto max-w-5xl px-8 pb-24">
        <div className="rounded border border-[#3D444D]/80 bg-[#151B23]/20">
          <div className="border-b border-[#3D444D] px-6 py-4">
            <h3 className="flex items-center gap-2 font-mono text-sm text-[#F0F6F6]">
              <Database className="h-4 w-4 text-ok-green" />
              [ Targeting Fee Matrix ]
            </h3>
          </div>
          <div className="p-6">
            <div className="space-y-0 divide-y divide-[#3D444D]/40">
              {TARGETING_FEES.map((row, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between py-4 first:pt-0 last:pb-0"
                >
                  <div>
                    <span className="text-sm text-[#F0F6F6]">{row.label}</span>
                    {row.example && (
                      <span className="ml-2 font-mono text-xs text-[#656C76]">
                        {row.example}
                      </span>
                    )}
                  </div>
                  <span className="font-mono text-sm font-medium text-ok-green">
                    {row.cost}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-6 font-mono text-[10px] text-[#656C76]">
              All fees collected at survey creation in SOL at current market rate.
            </p>
          </div>
        </div>
      </section>

      {/* ─── FEE CALCULATOR ───────────────────────────────────────────── */}
      <section className="mx-auto max-w-4xl px-8 pb-24">
        <FeeCalculator />
      </section>

      {/* ─── RESPONDENT SECTION ───────────────────────────────────────── */}
      <section className="mx-auto max-w-4xl px-8 pb-24">
        <div className="relative overflow-hidden rounded border border-[#3D444D] bg-[#151B23]/40">
          {/* Decorative corner */}
          <div className="absolute right-0 top-0 h-12 w-12 opacity-10"
               style={{ backgroundImage: 'linear-gradient(225deg, transparent 50%, #A371F7 50%)' }} />

          <div className="border-l-[3px] border-l-ok-purple p-6 md:p-10">
            <div className="mb-4 flex items-center gap-2">
              <Shield className="h-4 w-4 text-ok-purple" />
              <span className="font-mono text-[10px] text-[#656C76] uppercase tracking-wider">Respondent Protocol</span>
            </div>
            <h2 className="mb-4 text-xl font-medium tracking-tight text-[#F0F6F6]">
              Respondents always pay zero
            </h2>
            <p className="mb-8 max-w-2xl text-sm leading-relaxed text-[#9198A1]">
              Connecting your wallet, submitting a survey, and receiving rewards
              costs you nothing. All transaction fees are absorbed by the platform.
              Your only investment is your honest opinion.
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { value: "$0", label: "Submission fee" },
                { value: "$0", label: "Withdrawal fee" },
                { value: "$0", label: "Account creation fee" },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded border border-[#3D444D]/50 bg-[#0D1117]/60 p-4 text-center"
                >
                  <span className="block font-mono text-2xl font-semibold text-ok-green">
                    {stat.value}
                  </span>
                  <span className="mt-1 block font-mono text-[10px] text-[#656C76] uppercase">
                    {stat.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── FAQ ──────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-3xl px-8 pb-24">
        <div className="mb-8 border-b border-[#3D444D] pb-4">
          <h2 className="font-mono text-sm text-[#F0F6F6] flex items-center gap-2">
            <Zap className="h-4 w-4 text-ok-green" />
            [ Protocol Parameters (FAQ) ]
          </h2>
        </div>
        <div className="space-y-3">
          {FAQ_ITEMS.map((item, i) => (
            <div
              key={i}
              className="rounded border border-[#3D444D]/50 bg-[#151B23]/30"
            >
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="flex w-full items-center justify-between px-5 py-4 text-left"
              >
                <span className="text-xs font-medium text-[#F0F6F6]">
                  {item.q}
                </span>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 shrink-0 text-[#656C76] transition-transform duration-200",
                    openFaq === i && "rotate-180"
                  )}
                />
              </button>
              {openFaq === i && (
                <div className="border-t border-[#3D444D]/50 px-5 pb-4 pt-3">
                  <p className="text-xs leading-relaxed text-[#9198A1] border-l border-[#3D444D] pl-3">
                    {item.a}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ─── BOTTOM CTA ───────────────────────────────────────────────── */}
      <section className="border-t border-[#3D444D]/40 bg-[#151B23]/30 px-8 py-20 text-center">
        <h2 className="text-2xl font-medium tracking-tight text-[#F0F6F6] sm:text-3xl">
          Ready to run your first verified survey?
        </h2>
        <div className="mt-8 flex flex-col items-center justify-center gap-4">
          <Link to="/create">
            <button className="rounded bg-ok-green px-6 py-2.5 font-mono text-xs font-semibold text-[#0D1117] transition-all hover:bg-[#10C97A] hover:shadow-[0_0_15px_rgba(20,241,149,0.2)] active:scale-[0.97]">
              [ Create Survey → ]
            </button>
          </Link>
          <p className="font-mono text-[10px] text-[#656C76]">
            No subscription. No commitment. Pay only when you publish.
          </p>
        </div>
      </section>
    </div>
  );
}
