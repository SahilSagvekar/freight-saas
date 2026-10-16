"use client";

import { useEffect } from "react";

/** Last-resort screen when the whole app fails to render. Reports the error, then lets the person retry. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    try {
      void fetch("/api/client-error", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: error.message, stack: error.stack, path: window.location.pathname }),
        keepalive: true,
      });
    } catch {
      /* nothing more to do */
    }
  }, [error]);

  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", display: "grid", placeItems: "center", minHeight: "100vh", margin: 0 }}>
        <div style={{ maxWidth: 420, padding: 24, textAlign: "center" }}>
          <h1 style={{ fontSize: 22, marginBottom: 8 }}>Something went wrong</h1>
          <p style={{ color: "#555", marginBottom: 16 }}>We&apos;ve been told about it. Your bookings are safe. Please try again.</p>
          <button onClick={reset} style={{ padding: "10px 18px", borderRadius: 8, border: "1px solid #999", background: "white", cursor: "pointer" }}>Try again</button>
        </div>
      </body>
    </html>
  );
}
