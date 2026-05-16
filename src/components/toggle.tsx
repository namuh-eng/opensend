"use client";

interface ToggleProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

export function Toggle({
  label,
  checked,
  onChange,
  disabled = false,
}: ToggleProps) {
  return (
    <div className="inline-flex items-center gap-3 cursor-pointer">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        data-state={checked ? "checked" : "unchecked"}
        disabled={disabled}
        className={`relative inline-flex h-[20px] w-[36px] shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20 disabled:opacity-50 disabled:cursor-not-allowed ${
          checked ? "bg-white" : "bg-white/25"
        }`}
        onClick={() => onChange(!checked)}
      >
        <span
          className={`pointer-events-none block h-[16px] w-[16px] rounded-full shadow-sm transition-transform mt-[2px] ${
            checked
              ? "translate-x-[18px] bg-black"
              : "translate-x-[2px] bg-[#A1A4A5]"
          }`}
        />
      </button>
      <span className="text-[14px] text-fg">{label}</span>
    </div>
  );
}
