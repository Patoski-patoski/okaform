import { useState } from "react";
import {
  Copy,
  Check,
  AlertTriangle,
  LogOut,
} from "lucide-react";
import { Badge } from "@/components/okaform";
import { truncateAddress, getBadgeTier } from "@/components/okaform";
import { cn } from "@/lib/utils";
import { useWallet } from "@/components/WalletProvider";
import { useAuth } from "@/components/AuthProvider";

// ─── Types ─────────────────────────────────────────────────────────────────────

type SettingsSection = "profile" | "notifications" | "security" | "api" | "danger";

// ─── Mock data ─────────────────────────────────────────────────────────────────

const SETTINGS_NAV = [
  { id: "profile" as const, label: "Profile" },
  { id: "notifications" as const, label: "Notifications" },
  { id: "security" as const, label: "Security" },
  { id: "api" as const, label: "API Access" },
  { id: "danger" as const, label: "Danger Zone" },
] as const;

const AUTHORITY_KEY = "DC6BMdAaZVUuPKG2jDMnMUSb7AqYiiSUpjtScCnSui5V";

// ─── SettingsView component ────────────────────────────────────────────────────

export default function SettingsView() {
  const { publicKey, disconnect } = useWallet();
  const { user } = useAuth();

  const [activeSection, setActiveSection] = useState<SettingsSection>("profile");
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const [username, setUsername] = useState(user?.username ?? "");
  const [confirmDeleteData, setConfirmDeleteData] = useState(false);
  const [confirmCloseAll, setConfirmCloseAll] = useState(false);

  const wallet = publicKey?.toBase58() ?? "";
  const score = user?.globalScore ?? 0;
  const tier = getBadgeTier(score);
  const surveysCompleted = user?.surveysCompleted ?? 0;

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

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      {/* ── Left Column: Settings Nav ──────────────────────────────────────── */}
      <div className="w-full shrink-0 lg:w-[220px]">
        <nav className="flex flex-row gap-1 overflow-x-auto lg:flex-col">
          {SETTINGS_NAV.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveSection(item.id)}
              className={cn(
                "whitespace-nowrap font-mono text-sm transition-all",
                activeSection === item.id
                  ? "border-l-2 border-ok-green bg-ok-green/5 pl-3 text-ok-green"
                  : "pl-3.5 text-[#9198A1] hover:text-[#F0F6F6]"
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
                  <div className="flex-1 rounded border border-[#3D444D] bg-[#0D1117] px-3 py-2 font-mono text-xs text-[#F0F6F6]">
                    {wallet || "Not connected"}
                  </div>
                  <button
                    onClick={handleCopyAddress}
                    className="inline-flex items-center gap-1.5 rounded border border-[#3D444D] bg-transparent px-3 py-2 font-mono text-[10px] text-[#9198A1] transition-colors hover:border-[#656C76] hover:text-[#F0F6F6]"
                  >
                    {copyError ? (
                      <AlertTriangle className="h-3 w-3 text-ok-danger" />
                    ) : copiedAddress ? (
                      <Check className="h-3 w-3 text-ok-green" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                    {copyError ? "Failed" : copiedAddress ? "Copied" : "Copy"}
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
                    {score} points · {tierNames[tier] ?? "Ghost"} · {surveysCompleted} surveys completed
                  </span>
                </div>
                <button className="mt-2 font-mono text-[10px] text-ok-green transition-colors hover:text-[#10C97A]">
                  View your on-chain score →
                </button>
              </div>

              {/* Save Button */}
              <div className="flex justify-end border-t border-[#3D444D]/30 pt-4">
                <button className="rounded bg-ok-green px-4 py-2 font-mono text-xs font-semibold text-[#0D1117] transition-all hover:bg-[#10C97A] hover:shadow-[0_0_15px_rgba(20,241,149,0.2)]">
                  Save Changes
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
                Email notifications — provide an email address to receive survey alerts when responses come in, milestones are hit, or distributions complete.
              </p>
              <p className="mt-3 text-[10px] text-[#656C76]">
                In the meantime, activity updates appear in your Home dashboard feed.
              </p>
            </div>
          </div>
        )}

        {/* SECURITY SECTION */}
        {activeSection === "security" && (
          <div>
            <p className="mb-6 font-mono text-[10px] uppercase tracking-wider text-[#656C76]">
              SECURITY
            </p>
            <div className="rounded border border-[#3D444D] bg-[#151B23] p-5 space-y-5">
              {/* Active Session */}
              <div className="flex items-center justify-between">
                <div>
                  <label className="mb-1 block font-mono text-[10px] uppercase tracking-wider text-[#656C76]">
                    ACTIVE SESSION
                  </label>
                  <p className="font-mono text-xs text-[#9198A1]">
                    Authenticated via wallet signature · Expires in 6h 23m
                  </p>
                </div>
                <button
                  onClick={() => disconnect()}
                  className="inline-flex items-center gap-1.5 rounded border border-ok-danger/20 bg-transparent px-3 py-1.5 font-mono text-[10px] text-ok-danger transition-colors hover:bg-ok-danger/10"
                >
                  <LogOut className="h-3 w-3" />
                  Sign out
                </button>
              </div>

              {/* Authority Keypair */}
              <div className="border-t border-[#3D444D]/30 pt-5">
                <label className="mb-2 block font-mono text-[10px] uppercase tracking-wider text-[#656C76]">
                  BACKEND AUTHORITY
                </label>
                <div className="rounded border border-[#3D444D] bg-[#0D1117] px-3 py-2 font-mono text-xs text-[#F0F6F6]">
                  {truncateAddress(AUTHORITY_KEY)}
                </div>
                <p className="mt-2 text-[10px] leading-relaxed text-[#656C76]">
                  This keypair signs on-chain instructions on your behalf. It never holds funds and cannot move your escrow.
                </p>
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
                      Permanently removes all response data from our database. On-chain state is unaffected.
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
                      Immediately closes all active surveys and triggers distribution for each.
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
