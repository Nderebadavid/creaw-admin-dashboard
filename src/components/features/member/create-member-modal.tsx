"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { UserPlus } from "lucide-react";
import { CreateMemberForm } from "./create-member-form";

interface CreateMemberModalProps {
  onCreated?: () => void;
}

export function CreateMemberModal({ onCreated }: CreateMemberModalProps) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button><UserPlus className="w-4 h-4 mr-2" />Add Member</Button>} />
      <DialogContent className="max-w-[95vw] lg:max-w-[800px] max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>New Member</DialogTitle></DialogHeader>
        <CreateMemberForm
          onSuccess={() => { setOpen(false); onCreated?.(); }}
        />
      </DialogContent>
    </Dialog>
  );
}
