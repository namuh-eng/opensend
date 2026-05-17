interface StatusBadgeProps {
  status: string;
  variant?: "success" | "error" | "warning" | "info" | "default";
}

const variantStyles: Record<string, string> = {
  success: "text-green-400 bg-green-400/10",
  error: "text-red-400 bg-red-400/10",
  warning: "text-yellow-400 bg-yellow-400/10",
  info: "text-blue-400 bg-blue-400/10",
  default: "text-fg-2 bg-white/[0.08]",
};

export function StatusBadge({ status, variant = "default" }: StatusBadgeProps) {
  const style = variantStyles[variant] || variantStyles.default;

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md text-[12px] font-medium ${style}`}
    >
      {status}
    </span>
  );
}
