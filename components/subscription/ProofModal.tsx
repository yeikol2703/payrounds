"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";

export function ProofModalTrigger() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        Upload proof
      </Button>
      <Modal
        open={open}
        title="Payment proof"
        onClose={() => setOpen(false)}
      >
        <p className="text-sm text-slate-600">
          Attach a screenshot or receipt; stored in Firebase Storage and linked
          from the payment record.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={() => setOpen(false)}>Save</Button>
        </div>
      </Modal>
    </>
  );
}
