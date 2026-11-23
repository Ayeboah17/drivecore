"use client";

import { useEffect, useRef, useState } from "react";
import { Eraser, PenTool, CheckCircle2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function SignatureDialog({
  open,
  onOpenChange,
  onCapture,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCapture: (signedBy: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const [signedBy, setSignedBy] = useState("");
  const [hasStroke, setHasStroke] = useState(false);

  useEffect(() => {
    if (!open) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.lineWidth = 2.4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#D71920";
  }, [open]);

  function coords(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    };
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-3xl p-6 sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <PenTool className="size-4" aria-hidden="true" />
            </span>
            <DialogTitle className="text-lg font-extrabold">
              Digital Contract Signature Pad
            </DialogTitle>
          </div>
          <DialogDescription>
            Capture customer or fleet custodian sign-off for rental release.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <label className="block space-y-1.5 text-xs font-semibold">
            Signatory Full Name
            <input
              type="text"
              value={signedBy}
              onChange={(e) => setSignedBy(e.target.value)}
              placeholder="e.g. Kwame Mensah"
              className="h-10 w-full rounded-xl border border-input bg-surface px-3 text-sm font-medium"
            />
          </label>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span>Signature Canvas</span>
              <button
                type="button"
                onClick={() => {
                  const c = canvasRef.current;
                  c?.getContext("2d")?.clearRect(0, 0, c.width, c.height);
                  setHasStroke(false);
                }}
                className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
              >
                <Eraser className="size-3.5" aria-hidden="true" />
                Clear
              </button>
            </div>
            <canvas
              ref={canvasRef}
              width={460}
              height={160}
              onPointerDown={(e) => {
                drawingRef.current = true;
                const { x, y } = coords(e);
                const ctx = canvasRef.current?.getContext("2d");
                ctx?.beginPath();
                ctx?.moveTo(x, y);
                setHasStroke(true);
              }}
              onPointerMove={(e) => {
                if (!drawingRef.current) return;
                const { x, y } = coords(e);
                const ctx = canvasRef.current?.getContext("2d");
                ctx?.lineTo(x, y);
                ctx?.stroke();
              }}
              onPointerUp={() => {
                drawingRef.current = false;
              }}
              onPointerLeave={() => {
                drawingRef.current = false;
              }}
              className="h-40 w-full touch-none rounded-2xl border-2 border-dashed border-border bg-muted/30"
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              disabled={!hasStroke || !signedBy.trim()}
              onClick={() => {
                onCapture(signedBy.trim());
                setSignedBy("");
                setHasStroke(false);
                onOpenChange(false);
              }}
              className="gap-1.5"
            >
              <CheckCircle2 className="size-4" aria-hidden="true" />
              Confirm Sign-Off
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
