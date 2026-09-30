"use client";
import { useEffect, useId, useMemo, useState, type DragEvent } from "react";
import { CloudUpload, FileText, X } from "lucide-react";
import { fieldClass } from "./form-styles";

/** Largest file the design accepts. */
const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPT = "image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv";

const sizeLabel = (bytes: number) =>
  bytes > 1_048_576
    ? `${(bytes / 1_048_576).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;

/**
 * The file reference sent with the form. The portal has no file-storage
 * endpoint yet, so a picked file is sent as a `mock://uploads/…` reference
 * (what mock mode stores); a file already held in storage can be linked by
 * its https address instead.
 */
const referenceFor = (file: File) =>
  `mock://uploads/${Date.now()}/${file.name.replace(/[^A-Za-z0-9._-]+/g, "_")}`;

/**
 * The design's upload area: drop a file or browse, then a row showing the
 * chosen file with its size (or why it is too large). The file's reference
 * is submitted as the `name` form field.
 */
export function FileDropField({
  name,
  target,
  onChange,
}: {
  /** Form field that carries the file reference. */
  name: string;
  /** What the file is being attached to, for the note under the drop zone. */
  target?: string;
  /** Reports whether a usable file or link is chosen, e.g. to enable submit. */
  onChange?: (ready: boolean) => void;
}) {
  const inputId = useId();
  const [file, setFile] = useState<File | null>(null);
  const [link, setLink] = useState("");
  const [dragging, setDragging] = useState(false);
  const tooBig = Boolean(file && file.size > MAX_BYTES);
  const reference = file && !tooBig ? referenceFor(file) : /^https:\/\//.test(link) ? link : "";

  useEffect(() => onChange?.(Boolean(reference)), [reference, onChange]);
  // A local preview for a picked photo, released when the file changes.
  const preview = useMemo(
    () => (file?.type.startsWith("image/") ? URL.createObjectURL(file) : null),
    [file]
  );
  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  const pick = (next: File | undefined) => {
    if (next) setFile(next);
    setDragging(false);
  };
  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    pick(event.dataTransfer.files[0]);
  };

  return (
    <div className="flex flex-col gap-3">
      <label
        htmlFor={inputId}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-[14px] border-2 border-dashed bg-[#FFFBF7] p-[30px] text-center ${dragging ? "border-primary" : "border-[#E2C7B6]"}`}
      >
        <input
          id={inputId}
          type="file"
          accept={ACCEPT}
          className="sr-only"
          onChange={(event) => pick(event.target.files?.[0])}
        />
        <span className="flex size-[52px] items-center justify-center rounded-full bg-creaw-orange-soft text-primary">
          <CloudUpload size={26} aria-hidden="true" />
        </span>
        <span className="text-[15px] font-semibold text-creaw-ink">
          Drop a file here, or <span className="text-primary">browse</span>
        </span>
        <span className="text-[13px] font-normal text-creaw-faint">
          PDF, JPG, PNG, DOCX or XLSX · max 10 MB
        </span>
      </label>
      {file && (
        <div className="flex items-center gap-3 rounded-xl border border-creaw-line p-3">
          <span className="relative flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-[10px] bg-creaw-canvas text-primary">
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element -- a local object URL
              <img src={preview} alt="" className="absolute inset-0 size-full object-cover" />
            ) : (
              <FileText size={24} aria-hidden="true" />
            )}
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm font-semibold">{file.name}</span>
            <span
              role={tooBig ? "alert" : undefined}
              className={`text-[12.5px] ${tooBig ? "text-creaw-danger" : "text-[#1F7A4D]"}`}
            >
              {tooBig
                ? "File is larger than 10 MB — choose a smaller file"
                : `${sizeLabel(file.size)} · ready to upload`}
            </span>
          </span>
          <button
            type="button"
            aria-label="Remove file"
            onClick={() => setFile(null)}
            className="flex size-8 items-center justify-center rounded-lg bg-creaw-canvas text-creaw-body hover:bg-creaw-line"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
      )}
      {!file && (
        <label className="block text-sm">
          Or link a file already in storage
          <input
            type="url"
            value={link}
            onChange={(event) => setLink(event.target.value)}
            placeholder="https://…"
            className={fieldClass}
          />
        </label>
      )}
      <input type="hidden" name={name} value={reference} />
      {target && (
        <p className="rounded-[10px] bg-creaw-canvas px-3 py-2.5 text-[13px] text-creaw-body">
          Attaching to <b>{target}</b>. The file is linked to this record and logged in the audit
          trail.
        </p>
      )}
    </div>
  );
}
