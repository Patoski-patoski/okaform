import { useState, useEffect } from "react";
import QRCode from "qrcode";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  Loader2,
  QrCode,
  X,
} from "lucide-react";
import { Button } from "@/components/okaform";
import type { StatusType } from "@/components/okaform";
import { cn } from "@/lib/utils";
import { truncateAddress } from "@/lib/format";
import { useSurveyLifecycle } from "@/hooks/useSurveyLifecycle";
import { updateSurveySettings, deleteSurveyData } from "@/lib/forms";

interface SurveySettingsSurvey {
  id: string;
  title: string;
  description: string;
  status: StatusType;
  creator: string;
  responses: number;
  maxResponses: number;
  rewardPool: number;
  rewardType: "weighted" | "lucky_draw";
  createdAt: string;
  rewardDistributed: boolean;
  grossRewardPoolLamports: number;
  netRewardPoolLamports: number;
  feeLamports: number;
  feeBps: number;
  minWalletAge: number;
  minSolBalance: number;
  surveyPda: string | null;
  escrowPda: string | null;
  closedAt: string | null;
}

interface SurveySettingsTabProps {
  survey: SurveySettingsSurvey;
  onSurveyUpdated: (updated: SurveySettingsSurvey) => void;
  onSurveyDeleted: () => void;
}

const SOL_PER_LAMPORT = 1_000_000_000;

function formatSol(lamports: number): string {
  return (lamports / SOL_PER_LAMPORT).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  });
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function copyText(text: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // fall through to legacy path
    }
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  try {
    document.execCommand("copy");
    return true;
  } catch {
    return false;
  } finally {
    document.body.removeChild(textarea);
  }
}

function SectionCard({
  title,
  danger = false,
  children,
}: {
  title: string;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded border border-[#3D444D] bg-[#151B23]/60 p-5">
      <p
        className={cn(
          "mb-4 font-mono text-[10px] uppercase tracking-wider",
          danger ? "text-ok-danger" : "text-[#656C76]",
        )}
      >
        {title}
      </p>
      {children}
    </div>
  );
}

function ConfigRow({
  label,
  value,
  muted,
}: {
  label: string;
  value: React.ReactNode;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center justify-between border-b border-[#3D444D]/20 py-2.5 last:border-b-0">
      <span className="font-mono text-[10px] uppercase tracking-wider text-[#656C76]">
        {label}
      </span>
      <span
        className={cn(
          "font-mono text-xs",
          muted ? "text-[#656C76]" : "text-[#F0F6F6]",
        )}
      >
        {value}
      </span>
    </div>
  );
}

function CopyableValue({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="max-w-[220px] truncate">{truncateAddress(value)}</span>
      <button
        onClick={async () => {
          const ok = await copyText(value);
          if (ok) {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }
        }}
        className="text-[#656C76] transition-colors hover:text-[#F0F6F6]"
        title="Copy"
      >
        {copied ? (
          <Check className="h-3 w-3 text-ok-green" />
        ) : (
          <Copy className="h-3 w-3" />
        )}
      </button>
    </span>
  );
}

function QRModal({ url, onClose }: { url: string; onClose: () => void }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(url, { width: 180, margin: 1 })
      .then((data) => {
        if (!cancelled) setDataUrl(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [url]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-sm rounded border border-[#3D444D] bg-[#151B23] p-6 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-[#9198A1] transition-colors hover:text-[#F0F6F6]"
          aria-label="Close QR modal"
        >
          <X className="h-4 w-4" />
        </button>
        <p className="mb-4 font-mono text-[10px] uppercase tracking-wider text-[#656C76]">
          SCAN TO OPEN SURVEY
        </p>
        <div className="flex items-center justify-center rounded border border-[#3D444D] bg-white p-4">
          {dataUrl ? (
            <img
              src={dataUrl}
              alt="Survey QR code"
              className="h-[180px] w-[180px]"
            />
          ) : (
            <Loader2 className="h-8 w-8 animate-spin text-[#656C76]" />
          )}
        </div>
        <p className="mt-4 break-all text-center font-mono text-[10px] text-[#656C76]">
          {url}
        </p>
      </div>
    </div>
  );
}

function SurveySettingsTab({
  survey,
  onSurveyUpdated,
  onSurveyDeleted,
}: SurveySettingsTabProps) {
  const { closeAndDistribute } = useSurveyLifecycle();

  const isActive = survey.status === "active";

  const [title, setTitle] = useState(survey.title);
  const [description, setDescription] = useState(survey.description);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [copiedLink, setCopiedLink] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const [showQR, setShowQR] = useState(false);

  const [closeConfirm, setCloseConfirm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/form/${survey.id}`
      : `/form/${survey.id}`;

  const handleSave = async () => {
    const trimmedTitle = title.trim();
    if (trimmedTitle.length < 3) {
      setSaveError("Title must be at least 3 characters.");
      return;
    }
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      const updated = await updateSurveySettings(survey.id, {
        title: trimmedTitle,
        description: description.trim(),
      });
      onSurveyUpdated({
        ...survey,
        title: updated.title,
        description: updated.description,
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : "Failed to save survey settings.",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleCopyLink = async () => {
    const ok = await copyText(shareUrl);
    if (ok) {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 1500);
    } else {
      setCopyError(true);
      setTimeout(() => setCopyError(false), 2000);
    }
  };

  const handleCloseSurvey = async () => {
    setBusy(true);
    setActionError(null);
    try {
      await closeAndDistribute(survey.id);
      onSurveyUpdated({
        ...survey,
        status: "closed",
        closedAt: new Date().toISOString(),
        rewardDistributed: true,
      });
      setCloseConfirm(false);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Failed to close survey.",
      );
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteSurvey = async () => {
    setBusy(true);
    setActionError(null);
    try {
      await deleteSurveyData(survey.id);
      onSurveyDeleted();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Failed to delete survey data.",
      );
      setDeleteConfirm(false);
    } finally {
      setBusy(false);
    }
  };

  const filterRules: Array<{ label: string; value: string }> = [];
  if (survey.minWalletAge > 0) {
    filterRules.push({
      label: "Wallet Age",
      value: `${survey.minWalletAge} days minimum`,
    });
  }
  if (survey.minSolBalance > 0) {
    filterRules.push({
      label: "SOL Balance",
      value: `${survey.minSolBalance} SOL minimum`,
    });
  }
  if (filterRules.length === 0) {
    filterRules.push({ label: "Filter Rules", value: "None" });
  }

  return (
    <div className="space-y-5">
      {actionError && (
        <div className="flex items-start gap-3 rounded border border-ok-danger/20 bg-ok-danger/5 px-4 py-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-ok-danger" />
          <p className="flex-1 font-mono text-xs text-ok-danger">
            {actionError}
          </p>
          <button
            onClick={() => setActionError(null)}
            className="text-ok-danger/60 transition-colors hover:text-ok-danger"
            aria-label="Dismiss error"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ── Survey Details ─────────────────────────────────────────────────── */}
      <SectionCard title="Survey Details">
        <div className="space-y-4">
          <div>
            <label className="mb-2 block font-mono text-[10px] uppercase tracking-wider text-[#656C76]">
              TITLE
            </label>
            <input
              type="text"
              value={title}
              maxLength={100}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded border border-[#3D444D] bg-[#0D1117] px-3 py-2 font-mono text-sm text-[#F0F6F6] transition-colors focus:border-ok-green/40 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-2 block font-mono text-[10px] uppercase tracking-wider text-[#656C76]">
              DESCRIPTION
            </label>
            <textarea
              value={description}
              maxLength={500}
              rows={3}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full resize-y rounded border border-[#3D444D] bg-[#0D1117] px-3 py-2 font-mono text-sm text-[#F0F6F6] transition-colors focus:border-ok-green/40 focus:outline-none"
            />
          </div>
          <div className="flex items-center justify-between border-t border-[#3D444D]/30 pt-4">
            <div className="flex-1">
              {saveError && (
                <p className="font-mono text-[10px] text-ok-danger">
                  {saveError}
                </p>
              )}
              {saveSuccess && (
                <p className="font-mono text-[10px] text-ok-green">
                  Survey settings saved
                </p>
              )}
            </div>
            <Button
              variant="primary"
              size="md"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : saveSuccess ? (
                <Check className="h-3 w-3" />
              ) : null}
              {saving ? "Saving..." : saveSuccess ? "Saved" : "Save Changes"}
            </Button>
          </div>
        </div>
      </SectionCard>

      {/* ── Share Link ─────────────────────────────────────────────────────── */}
      <SectionCard title="Share Link">
        <p className="mb-3 text-xs leading-relaxed text-[#9198A1]">
          Share this link to let respondents open and complete the survey.
        </p>
        <div className="flex items-center gap-2">
          <div className="flex-1 truncate rounded border border-[#3D444D] bg-[#0D1117] px-3 py-2 font-mono text-xs text-[#F0F6F6]">
            {shareUrl}
          </div>
          <Button
            variant="secondary"
            size="md"
            onClick={handleCopyLink}
            className="shrink-0"
          >
            {copyError ? (
              <AlertTriangle className="h-3 w-3 text-ok-danger" />
            ) : copiedLink ? (
              <Check className="h-3 w-3 text-ok-green" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
            {copyError ? "Failed" : copiedLink ? "Copied" : "Copy"}
          </Button>
          <Button
            variant="secondary"
            size="md"
            onClick={() => setShowQR(true)}
            className="shrink-0"
          >
            <QrCode className="h-3 w-3" />
            QR
          </Button>
        </div>
      </SectionCard>

      {/* ── Survey Configuration ───────────────────────────────────────────── */}
      <SectionCard title="Survey Configuration">
        <ConfigRow
          label="Gross Reward Pool"
          value={`◎ ${formatSol(survey.grossRewardPoolLamports)}`}
        />
        <ConfigRow
          label="Protocol Fee"
          value={
            survey.feeLamports > 0
              ? `◎ ${formatSol(survey.feeLamports)} (${survey.feeBps / 100}%)`
              : "FREE (alpha)"
          }
          muted={survey.feeLamports === 0}
        />
        <ConfigRow
          label="Respondent Pool"
          value={`◎ ${formatSol(survey.netRewardPoolLamports)}`}
        />
        <ConfigRow label="Reward Type" value={survey.rewardType} />
        <ConfigRow label="Max Responses" value={String(survey.maxResponses)} />
        {filterRules.map((rule) => (
          <ConfigRow key={rule.label} label={rule.label} value={rule.value} />
        ))}
        <ConfigRow
          label="Survey PDA"
          value={
            survey.surveyPda ? <CopyableValue value={survey.surveyPda} /> : "—"
          }
        />
        <ConfigRow
          label="Escrow PDA"
          value={
            survey.escrowPda ? <CopyableValue value={survey.escrowPda} /> : "—"
          }
        />
      </SectionCard>

      {/* ── Danger Zone ────────────────────────────────────────────────────── */}
      <SectionCard title="Danger Zone" danger>
        <div className="space-y-4">
          {isActive ? (
            <div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-mono text-sm text-[#F0F6F6]">
                    Close Survey Early
                  </p>
                  <p className="mt-0.5 text-xs text-[#9198A1]">
                    This will immediately stop accepting responses and trigger
                    automatic reward distribution to{" "}
                    <span className="font-mono font-medium text-[#F0F6F6]">
                      {survey.responses}
                    </span>{" "}
                    respondents.
                  </p>
                </div>
                <Button
                  variant="danger"
                  size="md"
                  onClick={() => setCloseConfirm(true)}
                  className="shrink-0"
                >
                  Close Survey Early
                </Button>
              </div>
              {closeConfirm && (
                <div className="mt-3 flex flex-wrap items-center gap-3 rounded border border-ok-danger/20 bg-[#0D1117] p-3">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-ok-danger" />
                  <p className="flex-1 text-xs text-[#9198A1]">
                    Are you sure? This will close the survey and distribute
                    rewards on-chain.
                  </p>
                  <button
                    onClick={() => setCloseConfirm(false)}
                    disabled={busy}
                    className="rounded px-2 py-1 font-mono text-[10px] text-[#656C76] transition-colors hover:text-[#F0F6F6] disabled:opacity-40"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCloseSurvey}
                    disabled={busy}
                    className="inline-flex items-center gap-1 rounded bg-ok-danger px-2 py-1 font-mono text-[10px] font-medium text-[#F0F6F6] transition-colors hover:bg-[#DA3633] disabled:opacity-40"
                  >
                    {busy && <Loader2 className="h-3 w-3 animate-spin" />}
                    {busy ? "Closing..." : "Confirm"}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-ok-green" />
              <p className="font-mono text-xs text-[#9198A1]">
                Survey closed on{" "}
                {survey.closedAt ? formatDate(survey.closedAt) : "—"}.
              </p>
            </div>
          )}

          <div className="border-t border-ok-danger/20 pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-mono text-sm text-[#F0F6F6]">
                  Delete Survey Data
                </p>
                <p className="mt-0.5 text-xs text-[#9198A1]">
                  Permanently deletes all responses and survey data. This cannot
                  be undone. On-chain state is unaffected.
                </p>
              </div>
              <Button
                variant="danger"
                size="md"
                onClick={() => setDeleteConfirm(true)}
                disabled={isActive}
                className="shrink-0"
              >
                Delete Survey Data
              </Button>
            </div>
            {deleteConfirm && (
              <div className="mt-3 flex flex-wrap items-center gap-3 rounded border border-ok-danger/20 bg-[#0D1117] p-3">
                <AlertTriangle className="h-4 w-4 shrink-0 text-ok-danger" />
                <p className="flex-1 text-xs text-[#9198A1]">
                  Are you sure? This permanently deletes all response and survey
                  data.
                </p>
                <button
                  onClick={() => setDeleteConfirm(false)}
                  disabled={busy}
                  className="rounded px-2 py-1 font-mono text-[10px] text-[#656C76] transition-colors hover:text-[#F0F6F6] disabled:opacity-40"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteSurvey}
                  disabled={busy}
                  className="inline-flex items-center gap-1 rounded bg-ok-danger px-2 py-1 font-mono text-[10px] font-medium text-[#F0F6F6] transition-colors hover:bg-[#DA3633] disabled:opacity-40"
                >
                  {busy && <Loader2 className="h-3 w-3 animate-spin" />}
                  {busy ? "Deleting..." : "Confirm"}
                </button>
              </div>
            )}
          </div>
        </div>
      </SectionCard>

      {showQR && <QRModal url={shareUrl} onClose={() => setShowQR(false)} />}
    </div>
  );
}

export default SurveySettingsTab;
