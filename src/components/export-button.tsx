"use client";

interface ExportButtonProps {
  onClick: () => void;
  disabled?: boolean;
}

export function ExportButton({ onClick, disabled = false }: ExportButtonProps) {
  return (
    <button
      type="button"
      aria-label="Export"
      onClick={onClick}
      disabled={disabled}
      className="flex items-center justify-center w-8 h-8 rounded-[8px] border border-[rgba(176,199,217,0.145)] bg-[rgba(24,25,28,0.88)] text-[#A1A4A5] hover:text-[#F0F0F0] hover:border-[rgba(176,199,217,0.3)] transition-colors disabled:cursor-not-allowed disabled:opacity-50"
    >
      <svg
        aria-hidden="true"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
    </button>
  );
}
