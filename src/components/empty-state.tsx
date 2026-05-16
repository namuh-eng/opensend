interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: React.ReactNode;
}

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  icon,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6">
      {icon && <div className="mb-4 text-fg-2">{icon}</div>}
      <h3 className="text-[16px] font-semibold text-fg mb-2">{title}</h3>
      <p className="text-[14px] text-fg-2 text-center max-w-[360px] mb-6">
        {description}
      </p>
      {actionLabel && onAction && (
        <button
          type="button"
          className="px-4 py-2 rounded-md text-[13px] font-medium bg-white text-black hover:bg-gray-200 transition-colors"
          onClick={onAction}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
