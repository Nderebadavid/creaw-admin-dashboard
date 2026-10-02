"use client";
import { grantTone, stageLabel } from "./status";
import { FormBanner } from "@/components/ui/form-banner";
import { initials, titleCase } from "@/lib/format";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CircleCheck, CircleX, Eye, FolderArchive, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { DocumentPanel } from "@/components/ui/document-panel";
import { DocumentViewer, type ViewedDocument } from "@/components/ui/document-viewer";
import { PageHeading, type PageHeadingText } from "@/components/portal/page-heading";
import type { GrantDetail } from "./api";
import { downloadGrantPackAction, viewGrantDocumentAction } from "./actions";
import {
  AdvanceDialog,
  DeclineDialog,
  SendBackDialog,
  EditAwardDialog,
  EditPaymentDialog,
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
  canSendBack = false,
  canEditAward = false,
  canDisburse,
  canDownload,
  canLogReport,
}: {
  heading?: PageHeadingText;
  detail: GrantDetail;
  /**
   * The user may decide the next step, by signing or declining it: they hold
   * that step's permission and (maker-checker) have not signed an earlier step.
   */
  canAdvance: boolean;
  /** The user holds the permission of the latest sign-off, so may undo it. */
  canSendBack?: boolean;
  /** The user may change the awarded amount (the approval permission). */
  canEditAward?: boolean;
  canDisburse: boolean;
  canDownload: boolean;
  canLogReport: boolean;
}) {
  const router = useRouter();
  const [modal, setModal] = useState<
    "advance" | "decline" | "sendback" | "payment" | "editaward" | "editpayment" | "report" | null
  >(null);
  const [editingPayment, setEditingPayment] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [viewing, setViewing] = useState<ViewedDocument | null>(null);

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

  /** Opens a document in the viewer; the action writes the access to the audit log. */
  async function openDocument(documentId: number) {
    setBusy(true);
    setError("");
    const response = await viewGrantDocumentAction(detail.id, documentId);
    setBusy(false);
    if (response.success && response.document) setViewing(response.document);
    else setError(response.message);
  }

  const decideBlocked =
    "Needs this step's permission, and an officer who has not signed an earlier step";

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
      {heading && <PageHeading {...heading} />}
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
              Application #{detail.id} · {detail.project} · {titleCase(detail.grantType)} ·{" "}
              {detail.requestedAmount} requested
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <StatusBadge tone={grantTone(detail.status)}>{stageLabel(detail.status)}</StatusBadge>
          {packButton}
          {detail.previousStatus && (
            <Button
              variant="outline"
              disabled={!canSendBack || busy}
              title={!canSendBack ? "Needs the permission of the latest sign-off step" : undefined}
              onClick={() => setModal("sendback")}
            >
              <Undo2 size={16} />
              Send back
            </Button>
          )}
          {detail.nextStatus && (
            <Button
              variant="destructive"
              disabled={!canAdvance || busy}
              title={!canAdvance ? decideBlocked : undefined}
              onClick={() => setModal("decline")}
            >
              <CircleX size={16} />
              Decline application
            </Button>
          )}
          {detail.nextStatus && (
            <Button
              disabled={!canAdvance || busy}
              title={!canAdvance ? decideBlocked : undefined}
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
      {detail.sendBackReason && (
        <section className="rounded-2xl border border-[#F0DFC8] bg-[#FDF6EC] p-5">
          <h2 className="font-heading text-lg font-bold">Sign-off sent back</h2>
          <p className="mt-1 text-[15px]">{detail.sendBackReason}</p>
        </section>
      )}
      {detail.declineReason !== null && (
        <section className="rounded-2xl border border-[#F3CCC6] bg-creaw-danger-soft p-6">
          <h2 className="font-heading text-[22px] font-bold text-[#6E2019]">
            Application declined
          </h2>
          <p className="mt-1 text-[15px] text-[#6E2019]">
            {detail.declineReason || "No reason was recorded."}
          </p>
          <p className="mt-2 text-xs text-creaw-body">
            This decision is final. Who declined it and when is in the audit trail.
          </p>
        </section>
      )}
      <SignoffChain
        stage={detail.stage}
        declined={detail.declineReason !== null}
        history={detail.history}
      />
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
                onClick={() => void openDocument(doc.id)}
              >
                <Eye />
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
          canEditAward={canEditAward}
          onEditAward={() => setModal("editaward")}
          onEditPayment={
            canDisburse
              ? (id) => {
                  setEditingPayment(id);
                  setModal("editpayment");
                }
              : undefined
          }
        />
      </div>
      <ComplianceReports
        detail={detail}
        canLog={canLogReport}
        busy={busy}
        onLog={() => setModal("report")}
      />
      <DocumentViewer document={viewing} onClose={() => setViewing(null)} />
      <AdvanceDialog
        open={modal === "advance"}
        detail={detail}
        onClose={() => setModal(null)}
        onDone={done}
      />
      <SendBackDialog
        open={modal === "sendback"}
        detail={detail}
        onClose={() => setModal(null)}
        onDone={done}
      />
      <DeclineDialog
        open={modal === "decline"}
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
      <EditAwardDialog
        open={modal === "editaward"}
        detail={detail}
        onClose={() => setModal(null)}
        onDone={done}
      />
      <EditPaymentDialog
        open={modal === "editpayment"}
        detail={detail}
        paymentId={editingPayment}
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
