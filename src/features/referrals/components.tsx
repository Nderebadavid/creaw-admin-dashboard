"use client";

import { filterSelectClass } from "@/components/ui/form-styles";
import { FormBanner } from "@/components/ui/form-banner";
import { titleCase } from "@/lib/format";
import { useState } from "react";
import { ArrowLeftRight, CircleCheck, Pencil, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/data-table/data-table";
import { Pagination, type PageSize } from "@/components/data-table/pagination";
import { RowActions } from "@/components/data-table/row-actions";
import { TableCard } from "@/components/data-table/table-card";
import { usePagedList } from "@/components/data-table/use-paged-list";
import { ExportButton } from "@/components/ui/export-button";
import { PageHeading, type PageHeadingText } from "@/components/portal/page-heading";
import { hasModulePermission, type EffectiveGrant } from "@/lib/auth/grants";
import type { ReferralPage, ReferralQuery, ReferralView } from "./api";
import type { ReferralDestinationCatalog } from "./schemas";
import { exportReferralsAction, listReferralsAction } from "./actions";
import { referralColumns } from "./queue/columns";
import {
  EditReferralDialog,
  NewReferralDialog,
  RespondDialog,
  WithdrawReferralDialog,
} from "./queue/referral-dialogs";

const statuses = ["NEW", "ACCEPTED", "DECLINED", "WITHDRAWN"];

type Modal = { kind: "create" } | { kind: "decide" | "edit" | "withdraw"; referral: ReferralView };

/**
 * Referral queue: hand-offs between pillars and to partner institutions.
 * Clicking a new referral opens its decision; the row menu holds edit and
 * withdraw, which only the referring pillar may use.
 */
export function ReferralsContent({
  heading,
  initial,
  pillars,
  catalog = { internalPillarIds: [], partnerInstitutions: [] },
  grants,
}: {
  heading?: PageHeadingText;
  initial: ReferralPage;
  pillars: { id: number; name: string }[];
  catalog?: ReferralDestinationCatalog;
  grants: EffectiveGrant[];
}) {
  const list = usePagedList<ReferralView, ReferralQuery>(
    initial,
    { page: 1, pageSize: 25 },
    listReferralsAction
  );
  const [search, setSearch] = useState("");
  const [feedback, setFeedback] = useState("");
  const [modal, setModal] = useState<Modal | null>(null);
  // Who the user may refer is read when the dialog opens; the button needs the grants only.
  const canCreate =
    hasModulePermission(grants, "REFERRAL_CREATE") &&
    hasModulePermission(grants, "PARTICIPANT_VIEW");

  const close = () => setModal(null);
  const done = (message: string) => {
    setModal(null);
    setFeedback(message);
    void list.refresh();
  };
  const referralFor = (kind: "decide" | "edit" | "withdraw") =>
    modal?.kind === kind ? modal.referral : null;

  const actions = (
    <>
      {hasModulePermission(grants, "REPORT_EXPORT_CSV") && (
        <ExportButton exportAction={() => exportReferralsAction(list.query)} />
      )}
      {canCreate && (
        <Button onClick={() => setModal({ kind: "create" })}>
          <ArrowLeftRight size={16} />
          New referral
        </Button>
      )}
    </>
  );

  return (
    <div className="space-y-5">
      {heading ? <PageHeading {...heading} actions={actions} /> : actions}
      <FormBanner tone="success">{feedback}</FormBanner>
      {!modal && <FormBanner tone="error">{list.error}</FormBanner>}
      <TableCard
        title="All referrals"
        subtitle="Click a new referral to decide, edit or withdraw it"
        chipsLabel="Referral status"
        chips={[
          {
            label: "All",
            active: !list.query.status,
            onSelect: () => list.filter({ status: undefined }),
          },
          ...statuses.map((status) => ({
            label: titleCase(status),
            active: list.query.status === status,
            onSelect: () => list.filter({ status }),
          })),
        ]}
        filters={
          <select
            aria-label="Pillar"
            value={list.query.pillarId ?? ""}
            onChange={(event) => list.filter({ pillarId: Number(event.target.value) || undefined })}
            className={filterSelectClass}
          >
            <option value="">All pillars</option>
            {pillars.map((pillar) => (
              <option key={pillar.id} value={pillar.id}>
                {pillar.name}
              </option>
            ))}
          </select>
        }
        search={{
          value: search,
          label: "Search referrals",
          onChange: (value) => {
            setSearch(value);
            list.filter({ search: value || undefined });
          },
        }}
        footer={
          <Pagination
            page={list.data.page}
            pageSize={list.data.pageSize as PageSize}
            totalItems={list.data.totalItems}
            hint="Click a row to open the record"
            onPageChange={(page) => list.filter({ page }, false)}
            onPageSizeChange={(pageSize) => list.filter({ pageSize })}
          />
        }
      >
        <DataTable
          framed={false}
          label="Referrals"
          columns={referralColumns}
          sort={list.query.sort}
          onSortChange={(sort) => list.filter({ sort })}
          rows={list.data.items}
          getRowId={(row) => row.id}
          loading={list.loading}
          filtered={Boolean(list.query.status || list.query.pillarId || list.query.search)}
          // A new referral opens its decision; others fall back to editing when allowed.
          onRowOpen={(referral) => {
            if (referral.canRespond) setModal({ kind: "decide", referral });
            else if (referral.canEdit) setModal({ kind: "edit", referral });
          }}
          rowOpenLabel={(row) => `Open referral for ${row.participant}`}
          rowActions={(referral) => (
            <RowActions
              label={referral.participant}
              actions={[
                {
                  label: "Decide…",
                  icon: CircleCheck,
                  disabled: !referral.canRespond,
                  onSelect: () => setModal({ kind: "decide", referral }),
                },
                {
                  label: "Edit referral",
                  icon: Pencil,
                  disabled: !referral.canEdit,
                  onSelect: () => setModal({ kind: "edit", referral }),
                },
                {
                  label: "Withdraw",
                  icon: Undo2,
                  destructive: true,
                  disabled: !referral.canWithdraw,
                  onSelect: () => setModal({ kind: "withdraw", referral }),
                },
              ]}
            />
          )}
        />
      </TableCard>
      <NewReferralDialog
        open={modal?.kind === "create"}
        pillars={pillars}
        catalog={catalog}
        onClose={close}
        onDone={done}
      />
      <RespondDialog referral={referralFor("decide")} onClose={close} onDone={done} />
      <EditReferralDialog referral={referralFor("edit")} onClose={close} onDone={done} />
      <WithdrawReferralDialog referral={referralFor("withdraw")} onClose={close} onDone={done} />
    </div>
  );
}
