import { useState, useEffect } from "react";
import {
  Copy,
  Check,
  AlertTriangle,
  LogOut,
  ExternalLink,
  Loader2,
  ShieldCheck,
  Lock,
  Cpu,
} from "lucide-react";
import { Badge } from "@/components/okaform";
import { tierFromLabel, getBadgeTier } from "@/lib/tiers";
import { cn, formatRelativeTime } from "@/lib/utils";
import { useWallet } from "@/hooks/useWallet";
import { useAuth } from "@/hooks/useAuth";
import { setUsername as setUsernameApi } from "@/lib/auth";
import { getUserEarnings } from "@/lib/distribution";
import type { DistributionRecord } from "@/types/distribution";
import CurrencyLogo from "@/components/CurrencyLogo";

// ─── Types ─────────────────────────────────────────────────────────────────────

type SettingsSection =
  | "profile"
  | "notifications"
  | "security"
  | "api"
  | "danger";

// ─── Mock data ─────────────────────────────────────────────────────────────────

const SETTINGS_NAV = [
  { id: "profile" as const, label: "Profile" },
  { id: "notifications" as const, label: "Notifications" },
  { id: "security" as const, label: "Security" },
  { id: "api" as const, label: "API Access" },
  { id: "danger" as const, label: "Danger Zone" },
] as const;

const PROGRAM_ID =
  import.meta.env.VITE_PROGRAM_ID ||
  "DC6BMdAaZVUuPKG2jDMnMUSb7AqYiiSUpjtScCnSui5V";

// ─── SettingsView component ────────────────────────────────────────────────────

export default function SettingsView() {
  const { publicKey, disconnect } = useWallet();
  const { user, updateUser } = useAuth();

  const [activeSection, setActiveSection] =
    useState<SettingsSection>("profile");
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const [copiedProgramId, setCopiedProgramId] = useState(false);
  const [username, setUsername] = useState(user?.username ?? "");
  const [confirmDeleteData, setConfirmDeleteData] = useState(false);
  const [confirmCloseAll, setConfirmCloseAll] = useState(false);
  const [earningsRecords, setEarningsRecords] = useState<DistributionRecord[]>(
    [],
  );
  const [earningsLoading, setEarningsLoading] = useState(false);
  const [earningsLimit, setEarningsLimit] = useState(10);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const wallet = publicKey?.toBase58() ?? "";
  const score = user?.globalScore ?? 0;
  const tier = getBadgeTier(score);
  const surveysCompleted = user?.surveysCompleted ?? 0;

  useEffect(() => {
    if (!wallet) return;
    setEarningsLoading(true);
    getUserEarnings(wallet)
      .then((data) => setEarningsRecords(data))
      .catch(() => {})
      .finally(() => setEarningsLoading(false));
  }, [wallet]);

  const handleSaveUsername = async () => {
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      const normalizedUsername = username.trim().toLowerCase();
      await setUsernameApi(normalizedUsername);
      updateUser({ username: normalizedUsername });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to save username";
      setSaveError(message);
      setTimeout(() => setSaveError(null), 5000);
    } finally {
      setSaving(false);
    }
  };

  const tierNames: Record<string, string> = {
    grey: "Ghost",
    blue: "Cipher",
    green: "Sentinel",
    gold: "Oracle",
    diamond: "Sovereign",
  };

  const handleCopyAddress = () => {
    if (!navigator?.clipboard?.writeText) {
      setCopyError(true);
      setTimeout(() => setCopyError(false), 2000);
      return;
    }

    navigator.clipboard
      .writeText(wallet)
      .then(() => {
        setCopiedAddress(true);
        setTimeout(() => setCopiedAddress(false), 1500);
      })
      .catch(() => {
        setCopyError(true);
        setTimeout(() => setCopyError(false), 2000);
      });
  };

  const handleCopyProgramId = () => {
    if (!navigator?.clipboard?.writeText) return;
    navigator.clipboard.writeText(PROGRAM_ID).then(() => {
      setCopiedProgramId(true);
      setTimeout(() => setCopiedProgramId(false), 1500);
    });
  };

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      {/* ── Left Column: Settings Nav ──────────────────────────────────────── */}
      <div className="w-full shrink-0 lg:w-[220px]">
        <nav className="flex flex-row gap-1.5 overflow-x-auto pb-2 scrollbar-none lg:flex-col lg:pb-0">
          {SETTINGS_NAV.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveSection(item.id)}
              className={cn(
                "whitespace-nowrap font-mono text-xs sm:text-sm rounded px-3 py-2 transition-all shrink-0 text-left",
                activeSection === item.id
                  ? "bg-ok-green/10 text-ok-green border-b-2 lg:border-b-0 lg:border-l-2 border-ok-green font-semibold"
                  : "text-[#9198A1] hover:text-[#F0F6F6] hover:bg-[#151B23]",
              )}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </div>

      {/* ── Right Column: Section Content ──────────────────────────────────── */}
      <div className="flex-1 min-w-0">
        {/* PROFILE SECTION */}
        {activeSection === "profile" && (
          <div>
            <p className="mb-6 font-mono text-[10px] uppercase tracking-wider text-[#656C76]">
              PROFILE
            </p>
            <div className="rounded border border-[#3D444D] bg-[#151B23] p-5 space-y-5">
              {/* Wallet Address */}
              <div>
                <label className="mb-2 block font-mono text-[10px] uppercase tracking-wider text-[#656C76]">
                  CONNECTED WALLET
                </label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 min-w-0 rounded border border-[#3D444D] bg-[#0D1117] px-3 py-2 font-mono text-xs text-[#F0F6F6]">
                    <span
                      className="block truncate"
                      title={wallet || "Not connected"}
                    >
                      {wallet || "Not connected"}
                    </span>
                  </div>
                  <button
                    onClick={handleCopyAddress}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded border border-[#3D444D] bg-transparent px-3 py-2 font-mono text-[10px] text-[#9198A1] transition-colors hover:border-[#656C76] hover:text-[#F0F6F6]"
                  >
                    {copyError ? (
                      <AlertTriangle className="h-3 w-3 text-ok-danger" />
                    ) : copiedAddress ? (
                      <Check className="h-3 w-3 text-ok-green" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                    <span>
                      {copyError ? "Failed" : copiedAddress ? "Copied" : "Copy"}
                    </span>
                  </button>
                </div>
              </div>

              {/* Username */}
              <div>
                <label className="mb-2 block font-mono text-[10px] uppercase tracking-wider text-[#656C76]">
                  USERNAME
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="@yourhandle"
                  className="w-full rounded border border-[#3D444D] bg-[#0D1117] px-3 py-2 font-mono text-sm text-[#F0F6F6] transition-colors focus:border-ok-green/40 focus:outline-none"
                />
                <p className="mt-1.5 text-[10px] text-[#656C76]">
                  Displayed instead of your wallet address across Okaform
                </p>
              </div>

              {/* Reputation Score */}
              <div>
                <label className="mb-2 block font-mono text-[10px] uppercase tracking-wider text-[#656C76]">
                  ON-CHAIN REPUTATION
                </label>
                <div className="flex items-center gap-3">
                  <Badge tier={tier} className="text-[10px]" />
                  <span className="font-mono text-xs text-[#9198A1]">
                    {score} points · {tierNames[tier] ?? "Ghost"} ·{" "}
                    {surveysCompleted} surveys completed
                  </span>
                </div>
                <button className="mt-2 font-mono text-[10px] text-ok-green transition-colors hover:text-[#10C97A]">
                  View your on-chain score →
                </button>
              </div>

              {/* Earnings History */}
              <div className="border-t border-[#3D444D]/30 pt-5">
                <label className="mb-3 block font-mono text-[10px] uppercase tracking-wider text-[#656C76]">
                  EARNINGS HISTORY
                </label>
                {earningsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-ok-dim" />
                  </div>
                ) : earningsRecords.length === 0 ? (
                  <p className="text-xs text-[#656C76]">
                    No earnings yet. Complete surveys to start earning SOL.
                  </p>
                ) : (
                  <div>
                    {earningsRecords.slice(0, earningsLimit).map((record) => (
                      <div
                        key={record.txSignature + record.recipientWallet}
                        className="flex items-start justify-between border-b border-[#3D444D]/20 py-3 last:border-b-0"
                      >
                        <div className="space-y-0.5 min-w-0 flex-1 pr-3">
                          <p className="font-mono text-xs font-medium text-[#F0F6F6] truncate">
                            {record.formId}
                          </p>
                          <div className="flex items-center gap-2">
                            <Badge
                              tier={tierFromLabel(record.badgeTier)}
                              className="scale-90 origin-left"
                            />
                            <span className="font-mono text-[10px] text-[#656C76]">
                              {formatRelativeTime(
                                new Date(record.distributedAt),
                              )}
                            </span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-mono text-sm font-bold text-ok-green inline-flex items-center justify-end gap-1">
                            <CurrencyLogo
                              currency={record.rewardCurrency}
                              className="h-3.5 w-auto"
                            />{" "}
                            {(
                              (record.amountUnits ?? record.amountLamports) /
                              (record.rewardCurrency === "USDC" ? 1e6 : 1e9)
                            ).toFixed(record.rewardCurrency === "USDC" ? 2 : 4)}
                          </p>
                          <a
                            href={record.explorerUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-end gap-1 font-mono text-[10px] text-[#656C76] hover:text-ok-green transition-colors"
                          >
                            View tx
                            <ExternalLink className="h-2.5 w-2.5" />
                          </a>
                        </div>
                      </div>
                    ))}
                    {earningsRecords.length > earningsLimit && (
                      <button
                        onClick={() => setEarningsLimit((prev) => prev + 10)}
                        className="mt-3 w-full rounded border border-[#3D444D]/50 bg-transparent px-3 py-2 font-mono text-[10px] text-[#656C76] hover:text-[#F0F6F6] transition-colors"
                      >
                        Load more ({earningsRecords.length - earningsLimit}{" "}
                        remaining)
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Save Button */}
              <div className="flex items-center justify-between border-t border-[#3D444D]/30 pt-4">
                <div className="flex-1">
                  {saveError && (
                    <p className="font-mono text-[10px] text-ok-danger">
                      {saveError}
                    </p>
                  )}
                  {saveSuccess && (
                    <p className="font-mono text-[10px] text-ok-green">
                      Username saved
                    </p>
                  )}
                </div>
                <button
                  onClick={handleSaveUsername}
                  disabled={saving || !username.trim()}
                  className="inline-flex items-center gap-1.5 rounded bg-ok-green px-4 py-2 font-mono text-xs font-semibold text-[#0D1117] transition-all hover:bg-[#10C97A] hover:shadow-[0_0_15px_rgba(20,241,149,0.2)] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {saving ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : saveSuccess ? (
                    <Check className="h-3 w-3" />
                  ) : null}
                  {saving
                    ? "Saving..."
                    : saveSuccess
                      ? "Saved"
                      : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* NOTIFICATIONS SECTION */}
        {activeSection === "notifications" && (
          <div>
            <p className="mb-6 font-mono text-[10px] uppercase tracking-wider text-[#656C76]">
              NOTIFICATIONS
            </p>
            <div className="rounded border border-[#3D444D] bg-[#151B23] p-5">
              <div className="flex items-center gap-3 mb-4">
                <span className="rounded border border-[#3D444D] bg-[#0D1117] px-2 py-0.5 font-mono text-[9px] text-[#656C76] uppercase">
                  Coming Soon
                </span>
              </div>
              <p className="text-xs leading-relaxed text-[#9198A1]">
                Email notifications — provide an email address to receive survey
                alerts when responses come in, milestones are hit, or
                distributions complete.
              </p>
              <p className="mt-3 text-[10px] text-[#656C76]">
                In the meantime, activity updates appear in your Home dashboard
                feed.
              </p>
            </div>
          </div>
        )}

        {/* SECURITY SECTION */}
        {activeSection === "security" && (
          <div className="space-y-6">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-wider text-[#656C76]">
                SECURITY & PROTOCOL ARCHITECTURE
              </p>
              <p className="mt-1 text-xs text-[#9198A1]">
                Cryptographic session verification and on-chain smart contract
                transparency.
              </p>
            </div>

            {/* Active Session Card */}
            <div className="rounded border border-[#3D444D] bg-[#151B23] p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-[#3D444D]/30 pb-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-ok-green" />
                  <span className="font-mono text-xs font-semibold text-[#F0F6F6] uppercase tracking-wider">
                    Active Cryptographic Session
                  </span>
                </div>
                <button
                  onClick={() => disconnect()}
                  className="inline-flex items-center gap-1.5 rounded border border-ok-danger/20 bg-transparent px-3 py-1.5 font-mono text-[10px] text-ok-danger transition-colors hover:bg-ok-danger/10"
                >
                  <LogOut className="h-3 w-3" />
                  Disconnect Session
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                <div>
                  <label className="mb-1 block font-mono text-[10px] uppercase tracking-wider text-[#656C76]">
                    Connected Wallet
                  </label>
                  <div className="font-mono text-xs text-[#F0F6F6] bg-[#0D1117] border border-[#3D444D] rounded px-3 py-2 flex items-center justify-between">
                    <span className="truncate">
                      {wallet || "Not connected"}
                    </span>
                    {wallet && (
                      <button
                        onClick={handleCopyAddress}
                        className="ml-2 text-[#9198A1] hover:text-[#F0F6F6] transition-colors"
                        title="Copy Wallet"
                      >
                        {copiedAddress ? (
                          <Check className="h-3.5 w-3.5 text-ok-green" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <label className="mb-1 block font-mono text-[10px] uppercase tracking-wider text-[#656C76]">
                    Authentication Standard
                  </label>
                  <div className="font-mono text-xs text-[#9198A1] bg-[#0D1117] border border-[#3D444D] rounded px-3 py-2 flex items-center justify-between">
                    <span>Sign-In With Solana (Ed25519)</span>
                    <span className="inline-flex items-center gap-1.5 text-[10px] text-ok-green">
                      <span className="h-1.5 w-1.5 rounded-full bg-ok-green animate-pulse" />
                      Verified
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Smart Contract Card */}
            <div className="rounded border border-[#3D444D] bg-[#151B23] p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-[#3D444D]/30 pb-3">
                <div className="flex items-center gap-2">
                  <Cpu className="h-4 w-4 text-ok-green" />
                  <span className="font-mono text-xs font-semibold text-[#F0F6F6] uppercase tracking-wider">
                    On-Chain Program Verification
                  </span>
                </div>
                <a
                  href={`https://explorer.solana.com/address/${PROGRAM_ID}?cluster=devnet`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-mono text-[10px] text-ok-green hover:underline"
                >
                  View on Solana Explorer
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>

              <div>
                <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-wider text-[#656C76]">
                  Program ID (Anchor / Rust)
                </label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 min-w-0 rounded border border-[#3D444D] bg-[#0D1117] px-3 py-2 font-mono text-xs text-[#F0F6F6]">
                    <span className="block truncate" title={PROGRAM_ID}>
                      {PROGRAM_ID}
                    </span>
                  </div>
                  <button
                    onClick={handleCopyProgramId}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded border border-[#3D444D] bg-transparent px-3 py-2 font-mono text-[10px] text-[#9198A1] transition-colors hover:border-[#656C76] hover:text-[#F0F6F6]"
                  >
                    {copiedProgramId ? (
                      <Check className="h-3 w-3 text-ok-green" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                    <span>{copiedProgramId ? "Copied" : "Copy ID"}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Non-Custodial Architecture Card */}
            <div className="rounded border border-[#3D444D] bg-[#151B23] p-5 space-y-4">
              <div className="flex items-center gap-2 border-b border-[#3D444D]/30 pb-3">
                <Lock className="h-4 w-4 text-ok-green" />
                <span className="font-mono text-xs font-semibold text-[#F0F6F6] uppercase tracking-wider">
                  Non-Custodial Escrow Guarantees
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="rounded border border-[#3D444D]/50 bg-[#0D1117] p-3 space-y-1.5">
                  <p className="font-mono text-[11px] font-semibold text-[#F0F6F6]">
                    Deterministic PDAs
                  </p>
                  <p className="text-[10px] leading-relaxed text-[#9198A1]">
                    Reward pools (SOL & USDC) are held in Program Derived
                    Addresses governed strictly by smart contract bytecode, not
                    private keys.
                  </p>
                </div>

                <div className="rounded border border-[#3D444D]/50 bg-[#0D1117] p-3 space-y-1.5">
                  <p className="font-mono text-[11px] font-semibold text-[#F0F6F6]">
                    Creator Reclaim
                  </p>
                  <p className="text-[10px] leading-relaxed text-[#9198A1]">
                    When a survey completes or closes, leftover reward balances
                    and escrow rent are swept directly back to your creator
                    wallet.
                  </p>
                </div>

                <div className="rounded border border-[#3D444D]/50 bg-[#0D1117] p-3 space-y-1.5">
                  <p className="font-mono text-[11px] font-semibold text-[#F0F6F6]">
                    Zero-Custody Relayer
                  </p>
                  <p className="text-[10px] leading-relaxed text-[#9198A1]">
                    Backend authorities only submit bot reputation scores. They
                    cannot withdraw, redirect, or touch creator funds under any
                    circumstance.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* API ACCESS SECTION */}
        {activeSection === "api" && (
          <div>
            <p className="mb-6 font-mono text-[10px] uppercase tracking-wider text-[#656C76]">
              API ACCESS
            </p>
            <div className="rounded border border-[#3D444D] bg-[#151B23] p-5">
              <div className="flex items-center gap-3 mb-4">
                <span className="rounded border border-[#3D444D] bg-[#0D1117] px-2 py-0.5 font-mono text-[9px] text-[#656C76] uppercase">
                  Coming Soon
                </span>
              </div>
              <p className="font-mono text-sm font-medium text-[#F0F6F6]">
                Developer API
              </p>
              <p className="mt-1 text-xs text-[#9198A1]">
                Connect Okaform data to your own tools and workflows.
              </p>
            </div>
          </div>
        )}

        {/* DANGER ZONE SECTION */}
        {activeSection === "danger" && (
          <div>
            <p className="mb-6 font-mono text-[10px] uppercase tracking-wider text-ok-danger">
              DANGER ZONE
            </p>
            <div className="rounded border border-ok-danger/20 bg-ok-danger/5 p-5 space-y-4">
              {/* Delete Data */}
              <div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-mono text-sm text-[#F0F6F6]">
                      Delete all survey data
                    </p>
                    <p className="mt-0.5 text-xs text-[#9198A1]">
                      Permanently removes all response data from our database.
                      On-chain state is unaffected.
                    </p>
                  </div>
                  <button
                    onClick={() => setConfirmDeleteData(true)}
                    className="shrink-0 rounded border border-ok-danger/30 bg-transparent px-3 py-1.5 font-mono text-[10px] text-ok-danger transition-colors hover:bg-ok-danger/10"
                  >
                    Delete Data
                  </button>
                </div>
                {confirmDeleteData && (
                  <div className="mt-3 flex items-center gap-3 rounded border border-ok-danger/20 bg-[#0D1117] p-3">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-ok-danger" />
                    <p className="flex-1 text-xs text-[#9198A1]">
                      Are you sure? This cannot be undone.
                    </p>
                    <button
                      onClick={() => setConfirmDeleteData(false)}
                      className="rounded px-2 py-1 font-mono text-[10px] text-[#656C76] transition-colors hover:text-[#F0F6F6]"
                    >
                      Cancel
                    </button>
                    <button className="rounded bg-ok-danger px-2 py-1 font-mono text-[10px] font-medium text-[#F0F6F6] transition-colors hover:bg-[#DA3633]">
                      Confirm
                    </button>
                  </div>
                )}
              </div>

              {/* Close All Surveys */}
              <div className="border-t border-ok-danger/20 pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-mono text-sm text-[#F0F6F6]">
                      Close all active surveys
                    </p>
                    <p className="mt-0.5 text-xs text-[#9198A1]">
                      Immediately closes all active surveys and triggers
                      distribution for each.
                    </p>
                  </div>
                  <button
                    onClick={() => setConfirmCloseAll(true)}
                    className="shrink-0 rounded border border-ok-danger/30 bg-transparent px-3 py-1.5 font-mono text-[10px] text-ok-danger transition-colors hover:bg-ok-danger/10"
                  >
                    Close All
                  </button>
                </div>
                {confirmCloseAll && (
                  <div className="mt-3 flex items-center gap-3 rounded border border-ok-danger/20 bg-[#0D1117] p-3">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-ok-danger" />
                    <p className="flex-1 text-xs text-[#9198A1]">
                      Are you sure? This cannot be undone.
                    </p>
                    <button
                      onClick={() => setConfirmCloseAll(false)}
                      className="rounded px-2 py-1 font-mono text-[10px] text-[#656C76] transition-colors hover:text-[#F0F6F6]"
                    >
                      Cancel
                    </button>
                    <button className="rounded bg-ok-danger px-2 py-1 font-mono text-[10px] font-medium text-[#F0F6F6] transition-colors hover:bg-[#DA3633]">
                      Confirm
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
