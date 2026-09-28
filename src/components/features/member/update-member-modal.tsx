"use client";

import { useState, type ReactElement } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { UpdateMemberForm } from "./update-member-form";
import type { Member } from "@/types/member";

interface UpdateMemberModalProps {
  member: Member;
  trigger: ReactElement;
  onUpdated?: () => void;
}

export function UpdateMemberModal({ member, trigger, onUpdated }: UpdateMemberModalProps) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="max-w-[95vw] lg:max-w-[800px] max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Edit Member</DialogTitle></DialogHeader>
        <UpdateMemberForm
          member={member}
          onSuccess={() => { setOpen(false); onUpdated?.(); }}
        />
      </DialogContent>
    </Dialog>
  );
}
