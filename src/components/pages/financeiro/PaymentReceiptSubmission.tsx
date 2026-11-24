"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { type CalendarDate, getLocalTimeZone, Time, today, toCalendarDateTime } from "@internationalized/date";
import { CircleHelp, Clock3, Upload, X } from "lucide-react";
import { openAnimatedDialog } from "@/components/common/modal/openAnimatedDialog";
import { Button } from "@/components/common/button";
import { DatePicker } from "@/components/common/date-picker";
import { Input } from "@/components/common/input/input";
import { Select } from "@/components/common/select";
import { Textarea } from "@/components/common/textarea/textarea";
import { PAYMENT_METHOD_LABELS, PAYMENT_RECEIPT_ACCEPT, paymentReceiptFileSchema, paymentReceiptSubmissionSchema } from "@/schemas/billing/paymentReceipt";
import { extractApiErrorMessage } from "@/utils/http/apiError";

type Props = {
    charge: Pick<MemberChargeSummary, "id" | "finalAmount" | "effectiveStatus" | "paymentInReview">;
    submitAction: (chargeId: number, form: FormData) => Promise<{ id: number; status: string }>;
};

const receiptInstructions: Partial<Record<keyof typeof PAYMENT_METHOD_LABELS, string>> = {
    PIX: "Anexe o comprovante do Pix.",
    CASH: "Se tiver, anexe um print da conversa com o Matheus sobre o pagamento. Sem anexo, enviaremos uma declaração de pagamento em dinheiro para análise.",
    DEBIT_CARD: "Anexe o comprovante do pagamento no débito.",
    CREDIT_CARD: "Anexe o comprovante do pagamento no crédito.",
};

function cashPaymentDeclaration() {
    const canvas = document.createElement("canvas");
    canvas.width = 720;
    canvas.height = 240;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Não foi possível preparar a declaração de pagamento em dinheiro.");
    context.fillStyle = "#000";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#fff";
    context.textAlign = "center";
    context.font = "bold 40px sans-serif";
    context.fillText("Foi pago em dinheiro", 360, 115);
    context.font = "23px sans-serif";
    context.fillText("Declaração do associado · sem comprovante anexado", 360, 160);
    const encoded = canvas.toDataURL("image/png").split(",")[1];
    return new File([Uint8Array.from(atob(encoded), character => character.charCodeAt(0))], "declaracao-pagamento-em-dinheiro.png", { type: "image/png" });
}

export function PaymentReceiptSubmission({ charge, submitAction }: Props) {
    const id = useId();
    const [sent, setSent] = useState(false);
    const [error, setError] = useState("");
    const [fileError, setFileError] = useState("");
    const [paymentDate, setPaymentDate] = useState<CalendarDate | null>(null);
    const [maxPaymentDate, setMaxPaymentDate] = useState<CalendarDate>();
    const [showDateHelp, setShowDateHelp] = useState(false);
    const [method, setMethod] = useState<keyof typeof PAYMENT_METHOD_LABELS>("PIX");
    const isCash = method === "CASH";
    const dialog = useRef<HTMLDialogElement>(null);
    const router = useRouter();
    const queryClient = useQueryClient();
    const mutation = useMutation({
        mutationFn: (form: FormData) => submitAction(charge.id, form),
        onSuccess: () => {
            dialog.current?.close();
            setSent(true);
            void queryClient.invalidateQueries({ queryKey: ["billing", "payments"] });
            router.refresh();
        },
    });
    const unavailable = charge.effectiveStatus === "CANCELED" ? "Sua cobrança foi isentada. Você não precisa mais fazer o pagamento desta cobrança."
        : charge.effectiveStatus === "PAID" ? "Esta cobrança já está paga."
            : charge.effectiveStatus === "EXPIRED" ? "O prazo de envio expirou. Procure a gestão para regularizar esta cobrança." : "";

    function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (mutation.isPending || unavailable || sent) return;
        setError("");
        const form = new FormData(event.currentTarget);
        const [hour, minute] = String(form.get("paymentTime") ?? "").split(":");
        form.set("amount", String(charge.finalAmount));
        form.set("paymentMethod", method);
        form.set("paidAt", paymentDate && hour && minute ? toCalendarDateTime(paymentDate, new Time(Number(hour), Number(minute))).toDate(getLocalTimeZone()).toISOString() : "");
        form.delete("paymentTime");
        const receipt = form.get("receiptFile");
        if (isCash && (!(receipt instanceof File) || !receipt.name)) {
            try {
                form.set("receiptFile", cashPaymentDeclaration());
            } catch {
                setError("Não foi possível gerar a declaração. Anexe um arquivo ou tente novamente.");
                return;
            }
        }
        const parsed = paymentReceiptSubmissionSchema.safeParse(Object.fromEntries(form));
        if (!parsed.success) { setError(parsed.error.issues[0].message); return; }
        mutation.mutate(form);
    }

    if ((sent || charge.paymentInReview) && charge.effectiveStatus !== "PAID" && charge.effectiveStatus !== "CANCELED") return (
        <p role="status" data-payment-in-review className="flex items-center justify-end gap-2 text-sm font-semibold text-amber-800 sm:col-span-2 [:root[data-theme=dark]_&]:text-amber-200">
            <Clock3 size={17} aria-hidden="true" /> Comprovante em análise
        </p>
    );

    return <div className="flex min-w-0 flex-col items-end sm:col-span-2">
        <Button type="button" disabled={Boolean(unavailable) || mutation.isPending} aria-haspopup="dialog" aria-controls={`${id}-dialog`} aria-describedby={unavailable ? `${id}-unavailable` : undefined} onClick={event => {
            if (!dialog.current) return;
            dialog.current.querySelector("form")?.reset();
            setPaymentDate(null);
            setMaxPaymentDate(today(getLocalTimeZone()));
            setShowDateHelp(false);
            setMethod("PIX");
            setError("");
            setFileError("");
            mutation.reset();
            openAnimatedDialog(dialog.current, event.currentTarget);
        }} className="min-h-10 w-full px-4 text-sm sm:w-auto"><Upload size={16} aria-hidden="true" />Enviar comprovante</Button>
        {unavailable && <p id={`${id}-unavailable`} className="mt-2 text-right text-xs text-secondary">{unavailable}</p>}
        <dialog ref={dialog} id={`${id}-dialog`} aria-labelledby={`${id}-title`} onCancel={event => { if (mutation.isPending) event.preventDefault(); }} className="fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-2xl origin-top-left overflow-y-auto rounded-3xl border border-input-border bg-background text-primary shadow-2xl backdrop:bg-black/60">
            <header className="flex items-center gap-3 border-b border-input-border px-4 py-4 sm:px-6">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-j-yellow-300 text-[#061e50]"><Upload size={20} aria-hidden="true" /></span>
                <div className="min-w-0 flex-1">
                    <h2 id={`${id}-title`} className="text-lg font-extrabold">Enviar comprovante</h2>
                    <p className="text-sm text-secondary">Cobrança #{charge.id}</p>
                </div>
                <button type="button" aria-label="Fechar" disabled={mutation.isPending} onClick={() => dialog.current?.close()} className="grid size-10 shrink-0 cursor-pointer place-items-center rounded-full bg-background-secondary hover:bg-background-tertiary focus-visible:outline-2 disabled:cursor-not-allowed disabled:opacity-50"><X size={20} aria-hidden="true" /></button>
            </header>
            <form onSubmit={submit} aria-busy={mutation.isPending} className="flex min-w-0 flex-col gap-4 p-4 sm:p-6">
                <p className="text-sm text-secondary">Informe os dados do pagamento para análise da gestão. O valor deve corresponder ao total da cobrança.</p>
                <div className="grid min-w-0 gap-4 sm:grid-cols-2">
                    <Input label="Valor do pagamento (R$)" name="displayAmount" value={charge.finalAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} readOnly />
                    <Select.Unregister label="Forma de pagamento" name="paymentMethod" value={method} onChange={event => setMethod(event.target.value as keyof typeof PAYMENT_METHOD_LABELS)} required disabled={mutation.isPending}>
                        {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </Select.Unregister>
                </div>
                <div className="grid min-w-0 gap-4 sm:grid-cols-2">
                    <DatePicker<CalendarDate> label="Data do pagamento" granularity="day" value={paymentDate} onChange={setPaymentDate} maxValue={maxPaymentDate} isRequired isDisabled={mutation.isPending} className="[&_[data-slot=date-picker-trigger]]:min-h-6 [&_[data-slot=date-picker-trigger]]:min-w-6" />
                    <Input label="Hora do pagamento" name="paymentTime" type="time" required disabled={mutation.isPending} aria-describedby={showDateHelp ? `${id}-date-help` : undefined} labelAction={
                        <button type="button" aria-label="Ajuda sobre a data e a hora do pagamento" aria-expanded={showDateHelp} aria-controls={`${id}-date-help`} onClick={() => setShowDateHelp(visible => !visible)} onKeyDown={event => {
                            if (event.key !== "Escape" || !showDateHelp) return;
                            event.preventDefault();
                            setShowDateHelp(false);
                        }} className="grid size-6 cursor-pointer place-items-center rounded-full text-secondary hover:bg-background-tertiary focus-visible:outline-2">
                            <CircleHelp size={17} aria-hidden="true" />
                        </button>
                    } />
                </div>
                <p id={`${id}-date-help`} hidden={!showDateHelp} className="-mt-2 text-xs text-secondary">Informe quando você realmente pagou. A data pode ser diferente da data da cobrança ou do vencimento.</p>
                <Input label={isCash ? "Comprovante (opcional)" : "Comprovante"} name="receiptFile" type="file" accept={PAYMENT_RECEIPT_ACCEPT} required={!isCash} disabled={mutation.isPending} aria-describedby={`${id}-file-help`} error={fileError} onChange={event => {
                    const file = event.target.files?.[0];
                    if (!file) { setFileError(""); return; }
                    const parsed = paymentReceiptFileSchema.safeParse(file);
                    setFileError(parsed.success ? "" : parsed.error.issues[0].message);
                }} className="file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-background-secondary file:px-3 file:py-1 file:text-primary" />
                <p id={`${id}-file-help`} className="-mt-2 text-xs text-secondary">{receiptInstructions[method] ?? "Anexe o comprovante do pagamento."} Formatos aceitos: PDF, JPEG, PNG ou WebP, até 10 MiB.</p>
                <Textarea label="Observações (opcional)" name="notes" maxLength={500} rows={3} disabled={mutation.isPending} />
                {(error || mutation.isError) && <p role="alert" className="text-sm text-input-error-text">{error || extractApiErrorMessage(mutation.error)}</p>}
                <div className="flex flex-wrap justify-end gap-2">
                    <Button type="submit" disabled={mutation.isPending || Boolean(fileError)} isLoading={mutation.isPending} className="min-h-10 px-4 text-sm">{mutation.isPending ? "Enviando…" : "Enviar para análise"}</Button>
                    <Button type="button" disabled={mutation.isPending} onClick={() => dialog.current?.close()} className="min-h-10 border border-red-700 bg-red-700 px-4 text-sm text-white hover:border-red-800 hover:bg-red-800 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 disabled:cursor-not-allowed disabled:opacity-50">Cancelar</Button>
                </div>
            </form>
        </dialog>
    </div>;
}
