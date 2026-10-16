"use client";

import { Camera, CheckCircle2, ScanLine } from "lucide-react";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Alert } from "@/components/ui/alert";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Input } from "@/components/ui/field";
import { boardBookingAction, lookupTicketAction, type CheckinResult } from "@/server/booking-actions";

// The browser's built-in QR reader. Available in Chrome and Android browsers; others use the typed code.
type Detector = { detect: (src: HTMLVideoElement) => Promise<{ rawValue: string }[]> };
type DetectorCtor = new (opts: { formats: string[] }) => Detector;

export function CheckinClient() {
  const [code, setCode] = useState("");
  const [result, setResult] = useState<CheckinResult | null>(null);
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [scanning, setScanning] = useState(false);
  const [pending, start] = useTransition();
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const lastCode = useRef("");
  const supported = typeof window !== "undefined" && "BarcodeDetector" in window && !!navigator.mediaDevices?.getUserMedia;

  const stop = useCallback(() => {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    setScanning(false);
  }, []);
  useEffect(() => stop, [stop]);

  const lookup = useCallback((value: string) => {
    setMessage(null);
    lastCode.current = value;
    start(async () => {
      const res = await lookupTicketAction(value);
      if (!res.ok) return setMessage({ tone: "error", text: res.error });
      setResult(res.data ?? null);
      setCode("");
    });
  }, []);

  useEffect(() => {
    if (!scanning) return;
    let live = true;
    (async () => {
      try {
        const media = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (!live) return media.getTracks().forEach((t) => t.stop());
        stream.current = media;
        if (video.current) {
          video.current.srcObject = media;
          await video.current.play();
        }
        const Ctor = (window as unknown as { BarcodeDetector: DetectorCtor }).BarcodeDetector;
        const detector = new Ctor({ formats: ["qr_code"] });
        while (live && video.current) {
          const found = await detector.detect(video.current).catch(() => []);
          if (found[0]?.rawValue) {
            stop();
            lookup(found[0].rawValue);
            return;
          }
          await new Promise((r) => setTimeout(r, 250));
        }
      } catch {
        setMessage({ tone: "error", text: "Couldn't open the camera. Allow camera access, or type the code instead." });
        stop();
      }
    })();
    return () => {
      live = false;
    };
  }, [scanning, lookup, stop]);

  const board = () => {
    if (!result) return;
    start(async () => {
      const res = await boardBookingAction(result.bookingId);
      if (!res.ok) return setMessage({ tone: "error", text: res.error });
      setMessage({ tone: "success", text: res.data?.boarded ? `Boarded ${res.data.boarded} item${res.data.boarded === 1 ? "" : "s"}.` : "Everyone was already on board." });
      // Re-read the booking so the list shows the new statuses.
      const again = await lookupTicketAction(lastCode.current);
      if (again.ok && again.data) setResult(again.data);
    });
  };

  return (
    <div className="max-w-xl space-y-4">
      <Card>
        <CardBody className="space-y-3">
          <form onSubmit={(e) => { e.preventDefault(); if (code.trim()) lookup(code); }} className="flex gap-2">
            <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="HL1.…" aria-label="Ticket code" autoFocus autoComplete="off" autoCapitalize="off" spellCheck={false} className="font-mono" />
            <Button type="submit" disabled={pending || !code.trim()}><ScanLine className="size-4" aria-hidden />Check</Button>
          </form>
          {supported && (
            <Button type="button" variant="secondary" onClick={() => (scanning ? stop() : setScanning(true))}>
              <Camera className="size-4" aria-hidden />{scanning ? "Stop camera" : "Scan with camera"}
            </Button>
          )}
          {scanning && <video ref={video} muted playsInline className="aspect-square w-full rounded-lg bg-black object-cover" />}
        </CardBody>
      </Card>

      {message && <Alert tone={message.tone}>{message.text}</Alert>}

      {result && (
        <Card>
          <CardBody className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-mono text-lg font-semibold">{result.bookingNo}</p>
                <p className="text-sm text-muted">{result.contactName} · {result.route}</p>
              </div>
              <StatusBadge status={result.bookingStatus} />
            </div>
            {result.bookingStatus !== "CONFIRMED" && <Alert tone="error" title="Do not board">This booking is {result.bookingStatus.toLowerCase().replace("_", " ")}.</Alert>}
            {(result.voyageStatus === "CANCELLED" || result.voyageStatus === "ARRIVED") && <Alert tone="error" title="Wrong voyage">This voyage is {result.voyageStatus.toLowerCase()}.</Alert>}
            {result.paymentStatus === "UNPAID" || result.paymentStatus === "PARTIAL" ? <Alert tone="warning" title="Not fully paid">Send them to the desk to pay before boarding.</Alert> : null}
            <ul className="divide-y divide-line rounded-lg border border-line text-sm">
              {result.lines.map((l) => (
                <li key={l.entryId} className="flex items-center justify-between gap-3 px-3 py-2.5">
                  <span>{l.quantity} × {l.description}</span>
                  <StatusBadge status={l.status} />
                </li>
              ))}
            </ul>
            <div className="flex gap-2">
              <Button disabled={pending || result.bookingStatus !== "CONFIRMED" || result.lines.every((l) => l.status !== "PENDING")} onClick={board}>
                <CheckCircle2 className="size-4" aria-hidden />Board everyone
              </Button>
              <Button variant="ghost" onClick={() => { setResult(null); setMessage(null); }}>Next ticket</Button>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
