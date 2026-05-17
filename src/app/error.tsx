"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[opensend] unhandled error", error);
  }, [error]);

  return (
    <div className="relative isolate flex min-h-screen items-center justify-center overflow-hidden bg-bg px-4">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-[420px] left-1/2 -z-10 h-[760px] w-[1100px] -translate-x-1/2"
        style={{
          background:
            "radial-gradient(ellipse at center, color-mix(in oklch, var(--red) 18%, transparent) 0%, transparent 60%)",
          filter: "blur(60px)",
        }}
      />
      <div className="relative flex max-w-[520px] flex-col items-center gap-6 text-center">
        <span className="kicker text-red">{"// 500 · uncaught_exception"}</span>
        <h1 className="m-0 text-[44px] leading-tight tracking-tight text-fg">
          Something <span className="serif text-fg-2">broke</span>.
        </h1>
        <p className="text-[14px] leading-relaxed text-fg-2">
          We logged it. If this keeps happening, drop a note with the digest
          below — it helps us trace the request.
        </p>
        {error.digest && (
          <code className="mono rounded-md border border-line bg-bg-3 px-3 py-1.5 text-[11.5px] text-fg-3">
            digest: {error.digest}
          </code>
        )}
        <div className="mt-2 flex items-center gap-2">
          <button type="button" onClick={reset} className="btn btn-primary">
            Try again
          </button>
          <Link href="/" className="btn btn-ghost">
            Back to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
