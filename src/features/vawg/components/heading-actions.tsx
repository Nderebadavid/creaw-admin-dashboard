"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ExportButton } from "@/components/ui/export-button";
import { FormBanner } from "@/components/ui/form-banner";
import type { VawgWorkspace } from "../model";
import { OpenCaseDialog } from "./case-dialogs";
import { exportCases } from "./case-register";
import { LogCounsellingButton } from "./counselling-dialogs";

/** The VAWG page heading's "Export CSV" and "Open legal case", as in the design. */
export function VawgHeadingActions({
  workspace,
  canExport,
  canOpenCase,
  canLogCounselling = false,
  children,
}: {
  workspace: Pick<
    VawgWorkspace,
    "caseTypes" | "survivors" | "counselling" | "counsellors" | "currentUserId"
  >;
  canExport: boolean;
  canOpenCase: boolean;
  canLogCounselling?: boolean;
  /** Other heading actions, e.g. enrolling a participant in the pillar. */
  children?: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [feedback, setFeedback] = useState("");
  return (
    <>
      {canExport && <ExportButton exportAction={exportCases} />}
      {children}
      {canLogCounselling && workspace.counselling !== null && (
        <LogCounsellingButton workspace={workspace} />
      )}
      {canOpenCase && (
        <Button onClick={() => setOpen(true)}>
          <Plus />
          Open legal case
        </Button>
      )}
      <FormBanner tone="success">{feedback}</FormBanner>
      <OpenCaseDialog
        open={open}
        workspace={workspace}
        onClose={() => setOpen(false)}
        onDone={(message) => {
          setOpen(false);
          setFeedback(message);
          router.refresh();
        }}
      />
    </>
  );
}
