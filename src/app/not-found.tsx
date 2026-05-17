import Link from "next/link";

export default function NotFound() {
  return (
    <div className="relative isolate flex min-h-screen items-center justify-center overflow-hidden bg-bg px-4">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-[420px] left-1/2 -z-10 h-[760px] w-[1100px] -translate-x-1/2"
        style={{
          background:
            "radial-gradient(ellipse at center, color-mix(in oklch, var(--accent) 18%, transparent) 0%, transparent 60%)",
          filter: "blur(60px)",
        }}
      />
      <div className="relative flex max-w-[460px] flex-col items-center gap-6 text-center">
        <span className="kicker">{"// 404 · not_found"}</span>
        <h1 className="m-0 text-[64px] leading-none tracking-tight text-fg">
          <span className="serif text-fg-2">Lost</span> in transit.
        </h1>
        <p className="text-[14px] leading-relaxed text-fg-2">
          The page you're looking for doesn't exist — or it's been deprecated.
          Head back somewhere you know.
        </p>
        <div className="mt-2 flex items-center gap-2">
          <Link href="/" className="btn btn-primary">
            Back to dashboard
          </Link>
          <Link href="/docs" className="btn btn-ghost">
            Read the docs
          </Link>
        </div>
        <p className="mono mt-4 text-[11.5px] text-fg-4">
          status: 404 · route_not_matched
        </p>
      </div>
    </div>
  );
}
