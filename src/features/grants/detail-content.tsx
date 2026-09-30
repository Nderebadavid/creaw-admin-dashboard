"use client";
import { grantTone } from "./status";
import { FormBanner } from "@/components/ui/form-banner";
import { initials } from "@/lib/format";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CircleCheck, FolderArchive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { DocumentPanel } from "@/components/ui/document-panel";
import { PageHeading, type PageHeadingText } from "@/components/portal/page-heading";
import type { GrantDetail } from "./api";
import { downloadGrantPackAction, viewGrantDocumentAction } from "./actions";
import {
  AdvanceDialog,
  PaymentDialog,
  ReportPeriodDialog,
  advanceLabel,
} from "./detail/detail-dialogs";
import { ComplianceReports, DisbursementPanel, SignoffChain } from "./detail/panels";

/**
 * One grant application: its sign-off chain, supporting documents,
 * disbursement against the award and the compliance reports it owes.
 */
export function GrantDetailContent({
  heading,
  detail,
  canAdvance,
  canDisburse,
  canDownload,
  canLogReport,
}: {
  heading?: PageHeadingText;
  detail: GrantDetail;
  /** The user holds the next step's permission and has not signed an earlier step. */
  canAdvance: boolean;
  canDisburse: boolean;
  canDownload: boolean;
  canLogReport: boolean;
}) {
  const router = useRouter();
  const [modal, setModal] = useState<"advance" | "payment" | "report" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");

  const done = (message: string) => {
    setModal(null);
    setFeedback(message);
    router.refresh();
  };

  /** Document reads are audited server-side; mock mode returns metadata only. */
  async function audited(action: Promise<{ success: boolean; message: string }>, note: string) {
    setBusy(true);
    setError("");
    const response = await action;
    setBusy(false);
    if (response.success) setFeedback(note);
    else setError(response.message);
  }

  const packButton = (
    <Button
      variant="outline"
      disabled={!canDownload || busy}
      title={!canDownload ? "Document download permission required" : undefined}
      onClick={() =>
        void audited(
          downloadGrantPackAction(detail.id),
          "Application pack access audited. Mock mode provides metadata only."
        )
      }
    >
      <FolderArchive size={16} />
      Download application pack
    </Button>
  );

  return (
    <div className="space-y-5">
      {heading && <PageHeading {...heading} actions={packButton} />}
      <Link
        href="/grants"
        className="inline-flex items-center gap-2 text-sm font-semibold text-creaw-body"
      >
        <ArrowLeft size={16} />
        All applications
      </Link>
      <section className="flex flex-wrap items-center justify-between gap-5 rounded-2xl border border-creaw-line bg-white p-6">
        <div className="flex items-center gap-4">
          <span
            aria-hidden="true"
            className="flex size-[60px] items-center justify-center rounded-full bg-[#FDF0E3] text-xl font-bold text-[#A1521A]"
          >
            {initials(detail.applicant)}
          </span>
          <div>
            <h2 className="font-heading text-2xl font-bold">{detail.applicant}</h2>
            <p className="text-sm text-creaw-faint">
              {detail.project} · {detail.grantType.replaceAll("_", " ")} · {detail.requestedAmount}{" "}
              requested
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <StatusBadge tone={grantTone(detail.status)}>{detail.status}</StatusBadge>
          {!heading && packButton}
          {detail.nextStatus && (
            <Button
              disabled={!canAdvance || busy}
              title={!canAdvance ? "Permission required for this sign-off step" : undefined}
              onClick={() => setModal("advance")}
            >
              <CircleCheck size={16} />
              {advanceLabel(detail.nextStatus)}
            </Button>
          )}
        </div>
      </section>
      <FormBanner tone="success">{feedback}</FormBanner>
      {!modal && <FormBanner tone="error">{error}</FormBanner>}
      <SignoffChain stage={detail.stage} />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <DocumentPanel
          title="Documents & photos"
          documents={detail.documents.map((doc) => ({
            id: doc.id,
            name: doc.name,
            requirement: doc.name,
            action: (
              <Button
                key={doc.id}
                size="sm"
                variant="outline"
                disabled={!canDownload || busy}
                onClick={() =>
                  void audited(
                    viewGrantDocumentAction(detail.id, doc.id),
                    "Document access audited. Mock mode provides metadata only."
                  )
                }
              >
                View
              </Button>
            ),
          }))}
          requirements={["business plan"]}
        />
        <DisbursementPanel
          detail={detail}
          canRecord={canDisburse}
          busy={busy}
          onRecord={() => setModal("payment")}
        />
      </div>
      <ComplianceReports
        detail={detail}
        canLog={canLogReport}
        busy={busy}
        onLog={() => setModal("report")}
      />
      <AdvanceDialog
        open={modal === "advance"}
        detail={detail}
        onClose={() => setModal(null)}
        onDone={done}
      />
      <PaymentDialog
        open={modal === "payment"}
        detail={detail}
        onClose={() => setModal(null)}
        onDone={done}
      />
      <ReportPeriodDialog
        open={modal === "report"}
        detail={detail}
        onClose={() => setModal(null)}
        onDone={done}
      />
    </div>
  );
}
