"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

// ── Individual Toast ────────────────────────────────────────────────────

interface ToastProps {
  message: string;
  type: "success" | "error";
  onDismiss: () => void;
  duration?: number;
}

export function Toast({
  message,
  type,
  onDismiss,
  duration = 3000,
}: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, duration);
    return () => clearTimeout(timer);
  }, [onDismiss, duration]);

  return (
    <div
      className={`flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-[14px] border ${
        type === "success"
          ? "bg-accent/10 border-green-800 text-green-300"
          : "bg-red/10 border-red-800 text-red-300"
      }`}
      role="alert"
    >
      {type === "success" ? (
        <svg
          aria-hidden="true"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="text-green-400 shrink-0"
        >
          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
        </svg>
      ) : (
        <svg
          aria-hidden="true"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="text-red-400 shrink-0"
        >
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
        </svg>
      )}
      <span>{message}</span>
    </div>
  );
}

// ── Toast Provider / Hook ───────────────────────────────────────────────

interface ToastItem {
  id: string;
  message: string;
  type: "success" | "error";
}

interface ToastContextValue {
  toast: (message: string, type: "success" | "error") => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = useCallback((message: string, type: "success" | "error") => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, message, type }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext value={{ toast: addToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
        {toasts.map((t) => (
          <Toast
            key={t.id}
            message={t.message}
            type={t.type}
            onDismiss={() => removeToast(t.id)}
          />
        ))}
      </div>
    </ToastContext>
  );
}
