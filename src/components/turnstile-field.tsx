"use client";

import { useEffect, useRef, useState } from "react";

type TurnstileApi = {
  render: (el: HTMLElement, options: Record<string, unknown>) => string;
  reset: (widgetId?: string) => void;
  remove: (widgetId?: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let loading: Promise<TurnstileApi> | null = null;

/** Loads Cloudflare's script once per page, however many forms ask for it. */
function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  loading ??= new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error("Turnstile did not load")));
    script.onerror = () => {
      loading = null;
      reject(new Error("Turnstile script failed to load"));
    };
    document.head.appendChild(script);
  });
  return loading;
}

/**
 * The "I'm not a robot" box. Put it inside a <form>: it adds a hidden `cf-turnstile-response` field the server checks.
 * Renders nothing when no site key is given (the check is off). Pass the form's latest state as `resetSignal` so a
 * fresh token is requested after each submit, because a token only works once.
 */
export function TurnstileField({ siteKey, resetSignal }: { siteKey: string | undefined; resetSignal?: unknown }) {
  const box = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | undefined>(undefined);
  const [token, setToken] = useState("");

  useEffect(() => {
    if (!siteKey || !box.current) return;
    let cancelled = false;
    const el = box.current;
    loadTurnstile()
      .then((api) => {
        if (cancelled) return;
        widgetId.current = api.render(el, {
          sitekey: siteKey,
          callback: (t: string) => setToken(t),
          "expired-callback": () => setToken(""),
          "error-callback": () => setToken(""),
        });
      })
      .catch(() => {
        /* The server rejects the submit with a clear message when there is no token. */
      });
    return () => {
      cancelled = true;
      if (widgetId.current) window.turnstile?.remove(widgetId.current);
      widgetId.current = undefined;
    };
  }, [siteKey]);

  useEffect(() => {
    if (resetSignal === undefined || !widgetId.current) return;
    setToken("");
    window.turnstile?.reset(widgetId.current);
  }, [resetSignal]);

  if (!siteKey) return null;
  return (
    <div>
      <div ref={box} />
      <input type="hidden" name="cf-turnstile-response" value={token} readOnly />
    </div>
  );
}
