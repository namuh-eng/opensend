"use client";
import { authClient } from "@/lib/auth-client";
import Link from "next/link";
import { useState } from "react";

export default function AuthPage() {
  const [loading, setLoading] = useState(false);

  const signIn = async () => {
    setLoading(true);
    await authClient.signIn.social({
      provider: "google",
      callbackURL: "/emails",
    });
  };

  return (
    <div className="relative isolate flex min-h-screen items-center justify-center overflow-hidden bg-bg px-4">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-[420px] left-1/2 -z-10 h-[760px] w-[1100px] -translate-x-1/2"
        style={{
          background:
            "radial-gradient(ellipse at center, color-mix(in oklch, var(--accent) 22%, transparent) 0%, transparent 60%)",
          filter: "blur(60px)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.035] mix-blend-screen"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.5'/></svg>\")",
        }}
      />

      <div className="relative w-full max-w-[420px]">
        <div className="flex flex-col items-center gap-8 rounded-2xl border border-line-2 bg-bg-card/80 p-8 backdrop-blur-sm">
          <Link
            href="/"
            className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-accent-ink"
            aria-label="Opensend"
            style={{
              boxShadow:
                "0 0 0 1px rgba(196,255,90,0.25), 0 12px 40px -16px rgba(196,255,90,0.5)",
            }}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-6 w-6"
              role="img"
              aria-label="Opensend wordmark"
            >
              <title>Opensend</title>
              <rect x="3" y="5" width="18" height="14" rx="2.5" />
              <path d="m3 7 9 6 9-6" />
            </svg>
          </Link>

          <div className="flex flex-col items-center gap-2.5 text-center">
            <span className="kicker">{"// sign in"}</span>
            <h1 className="m-0 text-[28px] font-medium leading-tight tracking-tight text-fg">
              Welcome to <span className="serif text-fg-2">Opensend</span>
            </h1>
            <p className="text-[14px] leading-relaxed text-fg-2">
              Continue with your Google account.
              <br />
              No password. No friction.
            </p>
          </div>

          <button
            type="button"
            onClick={signIn}
            disabled={loading}
            className="btn btn-primary w-full disabled:cursor-wait disabled:opacity-70"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 18 18"
              role="img"
              aria-label="Google"
            >
              <title>Google</title>
              <path
                fill="#4285F4"
                d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18z"
              />
              <path
                fill="#34A853"
                d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2a4.8 4.8 0 0 1-7.18-2.54H1.83v2.07A8 8 0 0 0 8.98 17z"
              />
              <path
                fill="#FBBC05"
                d="M4.5 10.52a4.8 4.8 0 0 1 0-3.04V5.41H1.83a8 8 0 0 0 0 7.18z"
              />
              <path
                fill="#EA4335"
                d="M8.98 4.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 0 0 1.83 5.4L4.5 7.49a4.77 4.77 0 0 1 4.48-3.3z"
              />
            </svg>
            {loading ? "Redirecting…" : "Continue with Google"}
          </button>

          <div className="flex w-full items-center gap-3 text-[11px] uppercase tracking-[0.18em] text-fg-4">
            <span className="h-px flex-1 bg-line" />
            <span className="mono">single sign-on</span>
            <span className="h-px flex-1 bg-line" />
          </div>

          <p className="text-center text-[12.5px] leading-relaxed text-fg-3">
            By continuing, you agree to our{" "}
            <Link
              href="/terms"
              className="text-fg-2 underline-offset-2 hover:underline"
            >
              Terms
            </Link>{" "}
            and{" "}
            <Link
              href="/privacy"
              className="text-fg-2 underline-offset-2 hover:underline"
            >
              Privacy
            </Link>
            .
          </p>
        </div>

        <p className="mt-6 text-center text-[12.5px] text-fg-3">
          Self-hosting?{" "}
          <Link
            href="/docs"
            className="mono text-fg-2 underline-offset-2 hover:text-fg hover:underline"
          >
            See the self-host guide →
          </Link>
        </p>
      </div>
    </div>
  );
}
