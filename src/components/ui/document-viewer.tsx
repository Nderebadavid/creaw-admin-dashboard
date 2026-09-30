"use client";
import Image from "next/image";
import { Download, FileUp } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./dialog";
import { Button } from "./button";
import { formatDate, titleCase } from "@/lib/format";

/** A document the API has let the user open; its access is already in the audit log. */
export interface ViewedDocument {
  id: number;
  /** Display name, e.g. "Business plan". */
  name: string;
  /** The stored document_type, e.g. "business_plan". */
  documentType: string;
  fileUrl: string;
  /** The record the file belongs to, e.g. "Participant #3 · Grant application". */
  linkedRecord: string;
  uploadedAt?: string | null;
}

type Kind = "pdf" | "image" | "sheet" | "file";
const kindOf = (url: string): Kind => {
  const extension = url.split("?")[0].split(".").pop()?.toLowerCase() ?? "";
  if (extension === "pdf") return "pdf";
  if (["jpg", "jpeg", "png", "webp", "heic"].includes(extension)) return "image";
  if (["xlsx", "xls", "csv"].includes(extension)) return "sheet";
  return "file";
};
const kindLabel: Record<Kind, string> = {
  pdf: "PDF document",
  image: "Photo",
  sheet: "Spreadsheet",
  file: "File",
};
/** Only files served over https can be shown or fetched; mock:// references are metadata only. */
const isFetchable = (url: string) => /^https:\/\//.test(url);

/** A stand-in page for a PDF, as the design previews one: letterhead, text lines and signature. */
function PdfPage({ document }: { document: ViewedDocument }) {
  const reference = `CREAW/MERL/${document.documentType
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 8)}${document.id}`;
  return (
    <div className="flex aspect-[1/1.3] w-full max-w-[420px] flex-col gap-3 bg-white px-[30px] py-8 shadow-[0_8px_30px_-10px_rgba(34,28,24,.35)]">
      <div className="flex items-center justify-between border-b-2 border-primary pb-2.5">
        <Image
          src="/creaw-logo.png"
          alt="CREAW"
          width={84}
          height={60}
          className="h-auto w-[84px]"
        />
        <span className="font-mono text-[10px] text-creaw-faint">{reference}</span>
      </div>
      <p className="font-heading text-xl font-bold">{document.name}</p>
      <p className="text-[11.5px] text-creaw-body">Record: {document.linkedRecord}</p>
      {[
        [100, 94, 97, 70],
        [88, 96, 60],
      ].map((lines, block) => (
        <div key={block} className="mt-1.5 flex flex-col gap-[7px]" aria-hidden="true">
          {lines.map((width, index) => (
            <span
              key={index}
              className="h-[7px] rounded-[3px] bg-[#EEE8E1]"
              style={{ width: `${width}%` }}
            />
          ))}
        </div>
      ))}
      <div className="mt-auto flex items-end justify-between gap-4">
        <div className="flex flex-1 flex-col gap-1">
          <span className="h-[34px] border-b border-[#A39A92] bg-[repeating-linear-gradient(135deg,#F4EFE9_0_5px,#fff_5px_10px)]" />
          <span className="text-[10px] text-creaw-faint">Signature</span>
        </div>
        <div className="flex w-[90px] flex-col gap-1">
          <span className="text-[11px] font-semibold">
            {document.uploadedAt ? formatDate(document.uploadedAt) : "—"}
          </span>
          <span className="text-[10px] text-creaw-faint">Date</span>
        </div>
      </div>
      <p className="text-center text-[10px] text-[#A39A92]">Preview · page 1</p>
    </div>
  );
}

/**
 * The design's document viewer: a preview of the file on the left, its
 * details with Download and "Upload new version" on the right. Opening it is
 * audited by the caller's action.
 */
export function DocumentViewer({
  document,
  onClose,
  onReplace,
}: {
  document: ViewedDocument | null;
  onClose: () => void;
  /** Offers "Upload new version" when the user may replace the file. */
  onReplace?: () => void;
}) {
  const kind = document ? kindOf(document.fileUrl) : "file";
  // Stored names can be lower case ("business plan"); show them as titles.
  const shown = document && {
    ...document,
    name: document.name.charAt(0).toUpperCase() + document.name.slice(1),
  };
  const fetchable = document ? isFetchable(document.fileUrl) : false;
  return (
    <Dialog open={document !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[calc(100dvh-3rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[980px]">
        {shown && (
          <>
            <div className="flex flex-col gap-0.5 border-b border-creaw-divider px-6 py-5">
              <DialogTitle>{shown.name}</DialogTitle>
              <DialogDescription className="pr-10">{shown.linkedRecord}</DialogDescription>
            </div>
            <div className="flex min-h-0 flex-1 flex-wrap overflow-y-auto">
              <div className="flex min-h-[460px] min-w-0 flex-[1_1_440px] items-center justify-center bg-[#EDE8E2] p-6">
                {kind === "image" ? (
                  <div className="relative flex aspect-[4/3] w-full max-w-[520px] items-center justify-center overflow-hidden rounded-[10px] bg-[repeating-linear-gradient(135deg,#E3DAD0_0_10px,#EEE7DF_10px_20px)]">
                    {fetchable ? (
                      // eslint-disable-next-line @next/next/no-img-element -- files come from arbitrary storage hosts
                      <img
                        src={shown.fileUrl}
                        alt={shown.name}
                        className="absolute inset-0 size-full bg-creaw-ink object-contain"
                      />
                    ) : (
                      <span className="rounded-md bg-white/85 px-2.5 py-1.5 font-mono text-[13px] text-creaw-body">
                        photo · {shown.name}
                      </span>
                    )}
                  </div>
                ) : kind === "pdf" ? (
                  <PdfPage document={shown} />
                ) : (
                  <div className="flex w-full max-w-[420px] flex-col items-center gap-2 rounded-[10px] bg-white p-10 text-center shadow-[0_8px_30px_-10px_rgba(34,28,24,.35)]">
                    <span className="font-heading text-xl font-bold">{shown.name}</span>
                    <span className="text-[13px] text-creaw-faint">
                      {kind === "sheet" ? "Spreadsheet" : "This file type"} opens in its own
                      application after download.
                    </span>
                  </div>
                )}
              </div>
              <div className="flex min-w-[260px] flex-[0_1_300px] flex-col gap-3.5 px-6 py-[22px]">
                {(
                  [
                    ["Type", kindLabel[kind]],
                    ["Document", titleCase(shown.documentType)],
                    ["Source", fetchable ? "Portal upload" : "Stored reference"],
                    ["Date", shown.uploadedAt ? formatDate(shown.uploadedAt) : "—"],
                    ["Linked record", shown.linkedRecord],
                  ] as const
                ).map(([label, value]) => (
                  <div key={label} className="flex flex-col gap-0.5">
                    <span className="text-[12.5px] text-creaw-faint">{label}</span>
                    <span className="break-words text-sm font-semibold">{value}</span>
                  </div>
                ))}
                {!fetchable && (
                  <p className="rounded-[10px] bg-creaw-canvas px-3 py-2.5 text-[12.5px] text-creaw-body">
                    Only the file&apos;s reference is stored here, so there is no copy to download.
                  </p>
                )}
                <div className="mt-auto flex flex-col gap-2 pt-2.5">
                  <Button
                    disabled={!fetchable}
                    onClick={() => {
                      const link = window.document.createElement("a");
                      link.href = shown.fileUrl;
                      link.download = shown.name;
                      link.target = "_blank";
                      link.rel = "noopener";
                      link.click();
                    }}
                  >
                    <Download />
                    Download
                  </Button>
                  {onReplace && (
                    <Button variant="outline" onClick={onReplace}>
                      <FileUp />
                      Upload new version
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
