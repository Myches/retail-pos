"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

export type ToastType = "success" | "error" | "warning";

type Toast = {
  id: number;
  message: string;
  type: ToastType;
};

type ToastContextType = {
  showToast: (
    message: string,
    type?: ToastType,
    duration?: number
  ) => void;
};

const ToastContext = createContext<ToastContextType | null>(null);

const toastStyles: Record<ToastType, string> = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  error: "border-red-200 bg-red-50 text-red-800",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
};

const toastIcons: Record<ToastType, string> = {
  success: "✓",
  error: "!",
  warning: "!",
};

export function ToastProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const dismissToast = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    (
      message: string,
      type: ToastType = "success",
      duration = 3500
    ) => {
      const id = ++nextId.current;

      setToasts((current) => [
        ...current,
        { id, message, type },
      ]);

      const timer = setTimeout(() => {
        dismissToast(id);
      }, duration);

      timers.current.push(timer);
    },
    [dismissToast]
  );

  useEffect(() => {
    return () => {
      timers.current.forEach(clearTimeout);
    };
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}

      <div
        aria-live="polite"
        aria-atomic="false"
        className="no-print pointer-events-none fixed right-4 top-4 z-[100] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-3"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role={toast.type === "error" ? "alert" : "status"}
            className={`pointer-events-auto flex items-start gap-3 rounded-xl border p-4 shadow-lg shadow-slate-200/60 ${toastStyles[toast.type]}`}
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/80 text-sm font-bold">
              {toastIcons[toast.type]}
            </span>

            <p className="flex-1 text-sm font-medium leading-6">
              {toast.message}
            </p>

            <button
              type="button"
              aria-label="Dismiss notification"
              onClick={() => dismissToast(toast.id)}
              className="rounded-md px-1 text-lg leading-none opacity-60 hover:opacity-100"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error("useToast must be used inside ToastProvider.");
  }

  return context;
}