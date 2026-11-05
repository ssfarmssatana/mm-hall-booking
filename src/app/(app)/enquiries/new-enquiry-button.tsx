"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { EnquiryForm } from "./enquiry-form";
import type { Hall, Profile } from "@/lib/types";

export function NewEnquiryButton({ halls, profiles }: { halls: Hall[]; profiles: Profile[] }) {
  const sp = useSearchParams();
  const router = useRouter();
  const [open, setOpen] = useState(sp.get("new") === "1");
  const close = (v: boolean) => {
    setOpen(v);
    if (!v && sp.get("new")) router.replace("/enquiries");
  };
  return (
    <>
      <Button onClick={() => setOpen(true)}><Plus /> New enquiry</Button>
      <Dialog open={open} onOpenChange={close}>
        <DialogContent title="New enquiry" description="Record every call, walk-in and WhatsApp message." className="max-w-2xl">
          <EnquiryForm halls={halls} profiles={profiles} />
        </DialogContent>
      </Dialog>
    </>
  );
}
