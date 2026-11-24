'use client';

import { resolveValue, ToastBar, useToaster } from "react-hot-toast";

const toastOptions = {
    style: {
        background: "var(--surface)",
        color: "var(--text-primary)",
        border: "1px solid var(--gray-200)",
    },
};

export default function ToastProvider({ children }: { children: React.ReactNode }) {
    const { toasts, handlers } = useToaster(toastOptions);
    const visibleToasts = toasts.filter(toast => toast.visible).slice(0, 3);

    return (
        <>
            {visibleToasts.length > 0 && (
                <div
                    role="region"
                    aria-label="Notificações"
                    tabIndex={0}
                    className="fixed inset-x-4 bottom-[var(--toast-bottom)] z-[9999] mx-auto flex max-h-[calc(40dvh-var(--toast-bottom))] max-w-[350px] flex-col-reverse gap-2 overflow-y-auto overscroll-contain [--toast-bottom:max(1rem,env(safe-area-inset-bottom))] [overflow-wrap:anywhere] focus-visible:outline-2"
                    onMouseEnter={handlers.startPause}
                    onMouseLeave={handlers.endPause}
                >
                    {visibleToasts.map(toast => (
                        <div key={toast.id} className="shrink-0">
                            {toast.type === 'custom'
                                ? resolveValue(toast.message, toast)
                                : <ToastBar toast={toast} style={{ opacity: 1 }} />}
                        </div>
                    ))}
                </div>
            )}
            {children}
        </>
    )
}
