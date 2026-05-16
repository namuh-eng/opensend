"use client";

import { useCallback, useState } from "react";

interface CopyToClipboardProps {
  value: string;
  className?: string;
}

export function CopyToClipboard({
  value,
  className = "",
}: CopyToClipboardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [value]);

  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <span className="text-[14px] text-fg-2 font-mono truncate">{value}</span>
      <button
        type="button"
        className="p-1 rounded hover:bg-white/[0.14] text-fg-2 hover:text-fg transition-colors shrink-0"
        onClick={handleCopy}
        aria-label={copied ? "Copied" : "Copy to clipboard"}
      >
        {copied ? (
          <svg
            aria-hidden="true"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="text-green-400"
          >
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
          </svg>
        ) : (
          <svg
            aria-hidden="true"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z" />
          </svg>
        )}
      </button>
    </span>
  );
}
