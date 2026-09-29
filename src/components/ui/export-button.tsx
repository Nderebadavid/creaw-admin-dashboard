"use client";
import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "./button";
export type ExportResult = {success:true;filename:string;content:string} | {success:false;error:string};
/** Bind the current filters to auditedExportAction on the server. CSV is produced only after authorization and audit. */
export function ExportButton({exportAction,label="Export CSV",disabled=false}:{exportAction:()=>Promise<ExportResult>;label?:string;disabled?:boolean}) {
  const [pending,setPending] = useState(false), [error,setError] = useState("");
  async function download() {
    setPending(true);setError("");
    try {
      const result = await exportAction();
      if (!result.success) {setError(result.error);return;}
      const url = URL.createObjectURL(new Blob([result.content],{type:"text/csv;charset=utf-8"}));
      const link = document.createElement("a");link.href=url;link.download=result.filename;document.body.appendChild(link);link.click();link.remove();
      setTimeout(() => URL.revokeObjectURL(url),0);
    } catch {setError("Could not export records. Please try again.");}
    finally {setPending(false);}
  }
  return <span className="inline-flex flex-col items-start gap-2"><Button variant="outline" disabled={disabled || pending} onClick={download}><Download aria-hidden="true" size={16} />{pending ? "Preparing export…" : label}</Button>{error && <span role="alert" className="text-sm text-destructive">{error}</span>}</span>;
}
