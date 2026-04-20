"use client";

import { Turnstile } from "@marsidev/react-turnstile";
import { useRef } from "react";

interface TurnstileWidgetProps {
  onToken: (token: string) => void;
  siteKey: string;
}

/**
 * Client-side Cloudflare Turnstile widget.
 *
 * The parent page reads `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and passes it as
 * `siteKey`. Only renders if the key is set — otherwise parent should skip
 * rendering entirely (check `clientEnv.NEXT_PUBLIC_TURNSTILE_SITE_KEY`).
 *
 * `onToken` fires when the challenge completes. The parent should store the
 * token in state and include it in the API request body.
 */
export function TurnstileWidget({ onToken, siteKey }: TurnstileWidgetProps) {
  const ref = useRef<HTMLDivElement>(null);

  return (
    <div ref={ref} className="flex justify-center">
      <Turnstile
        siteKey={siteKey}
        onSuccess={onToken}
        onExpire={() => onToken("")}
        onError={() => onToken("")}
        options={{ theme: "dark", size: "flexible" }}
      />
    </div>
  );
}
