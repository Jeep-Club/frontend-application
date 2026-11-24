"use client";

import { openAnimatedDialog } from "@/components/common/modal/openAnimatedDialog";
import { ReceiptText, X } from "lucide-react";
import { useId, useRef, useState } from "react";
import PaymentReceipt from "./PaymentReceipt";

export default function PaymentReceiptDialog({ paymentId }: { paymentId: number }) {
    const id = useId();
    const dialog = useRef<HTMLDialogElement>(null);
    const [isOpen, setIsOpen] = useState(false);

    return <>
        <button type="button" aria-haspopup="dialog" aria-controls={id} className="flex min-h-10 min-w-0 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-input-border px-2 py-2 text-xs font-bold text-primary hover:bg-background-tertiary focus-visible:outline-2 focus-visible:outline-offset-2" onClick={event => {
            if (!dialog.current) return;
            openAnimatedDialog(dialog.current, event.currentTarget);
            setIsOpen(true);
        }}><ReceiptText size={15} className="shrink-0" aria-hidden="true" />Comprovante</button>
        <dialog ref={dialog} id={id} aria-labelledby={`${id}-title`} onClose={() => setIsOpen(false)} className="fixed inset-0 m-auto h-dvh max-h-none w-full max-w-none origin-top-left overflow-hidden bg-background text-primary backdrop:bg-black/60 sm:h-[min(52rem,calc(100dvh-2rem))] sm:w-[calc(100%-2rem)] sm:max-w-4xl sm:rounded-2xl sm:border sm:border-input-border sm:shadow-2xl">
            <div className="flex h-full flex-col">
                <header className="flex shrink-0 items-center justify-between gap-4 border-b border-input-border p-4">
                    <h2 id={`${id}-title`} className="text-lg font-extrabold">Comprovante do pagamento</h2>
                    <button type="button" aria-label="Fechar comprovante" onClick={() => dialog.current?.close()} className="grid size-10 shrink-0 cursor-pointer place-items-center rounded-full bg-background-secondary hover:bg-background-tertiary focus-visible:outline-2"><X size={20} aria-hidden="true" /></button>
                </header>
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
                    {isOpen && <PaymentReceipt id={paymentId} embedded />}
                </div>
            </div>
        </dialog>
    </>;
}
