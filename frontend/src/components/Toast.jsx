import { useState, useCallback, createContext, useContext, useRef, useEffect } from "react";

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(({ message, variant = "success", duration = 4000 }) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev.slice(-4), { id, message, variant }]);
    if (duration > 0) {
      setTimeout(() => dismiss(id), duration);
    }
    return id;
  }, [dismiss]);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div
        style={{
          position: "fixed",
          bottom: "1.5rem",
          right: "1.5rem",
          zIndex: 9999,
          display: "flex",
          flexDirection: "column",
          gap: "0.6rem",
          pointerEvents: "none",
          maxWidth: "400px",
          width: "calc(100vw - 3rem)",
        }}
        aria-live="polite"
        aria-atomic="false"
      >
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onDismiss }) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    requestAnimationFrame(() => {
      el.style.opacity = "1";
      el.style.transform = "translateY(0)";
    });
  }, []);

  const icons = {
    success: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 6L9 17l-5-5" />
      </svg>
    ),
    danger: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    ),
    warning: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
    info: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
      </svg>
    ),
  };

  const colors = {
    success: { bg: "#f0fdf4", border: "#bbf7d0", text: "#166534", icon: "#16a34a" },
    danger:  { bg: "#fff1f2", border: "#fecdd3", text: "#9f1239", icon: "#e11d48" },
    warning: { bg: "#fffbeb", border: "#fde68a", text: "#92400e", icon: "#d97706" },
    info:    { bg: "#eff6ff", border: "#bfdbfe", text: "#1e3a5f", icon: "#2563eb" },
  };

  const c = colors[toast.variant] || colors.info;

  return (
    <div
      ref={ref}
      role="alert"
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: "0.7rem",
        padding: "0.85rem 1rem",
        background: c.bg,
        border: `1px solid ${c.border}`,
        borderRadius: "10px",
        boxShadow: "0 4px 20px rgba(0,0,0,0.12)",
        color: c.text,
        fontSize: "0.88rem",
        fontWeight: 500,
        lineHeight: 1.45,
        opacity: 0,
        transform: "translateY(8px)",
        transition: "opacity 250ms ease, transform 250ms ease",
        pointerEvents: "all",
      }}
    >
      <span style={{ color: c.icon, flexShrink: 0, marginTop: "1px" }}>
        {icons[toast.variant] || icons.info}
      </span>
      <span style={{ flex: 1 }}>{toast.message}</span>
      <button
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss"
        style={{
          flexShrink: 0,
          background: "none",
          border: "none",
          cursor: "pointer",
          color: c.text,
          opacity: 0.5,
          padding: "0 0.2rem",
          lineHeight: 1,
          fontSize: "1.1rem",
          marginTop: "-1px",
        }}
      >
        &times;
      </button>
    </div>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be inside <ToastProvider>");
  return ctx;
}
