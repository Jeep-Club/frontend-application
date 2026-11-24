"use client";

import { History, X } from "lucide-react";
import { useActionState, useId, useRef, useState } from "react";
import { Button, ButtonIcon } from "@/components/common/button";
import { openAnimatedDialog } from "@/components/common/modal/openAnimatedDialog";
import { getChargeDefinitionDeletionHistoryAction } from "@/server/actions/billing/chargeDefinitions/deletionHistory";
import { getActionFailure } from "@/utils/http/ActionError";
import { extractApiErrorMessage } from "@/utils/http/apiError";
import { displayBillingValue } from "./billingDisplay";

type HistoryState = {
    data?: Awaited<ReturnType<typeof getChargeDefinitionDeletionHistoryAction>>;
    error?: string;
};

async function lookup(_previous: HistoryState, formData: FormData): Promise<HistoryState> {
    const originalId = Number(formData.get("originalId"));
    if (!Number.isSafeInteger(originalId) || originalId < 1) {
        return { error: "Informe um código de definição válido." };
    }
    try {
        return { data: await getChargeDefinitionDeletionHistoryAction(originalId) };
    } catch (error) {
        return { error: getActionFailure(error)?.status === 404
            ? "Nenhum histórico de exclusão foi encontrado para esse código."
            : extractApiErrorMessage(error) };
    }
}

const fields = {
    deletedAt: "Excluída em",
    deletedByUserName: "Excluída por",
    reason: "Motivo",
    previousStatus: "Situação anterior",
    defaultAmount: "Valor padrão",
    recurrenceType: "Recorrência",
    required: "Obrigatória",
    paymentAcceptancePolicy: "Política de pagamento",
    latePaymentGraceDays: "Tolerância (dias)",
    createdAt: "Criada em",
    updatedAt: "Atualizada em",
    archivedAt: "Arquivada em",
} as const;

export function ChargeDefinitionDeletionHistoryModal() {
    const dialog = useRef<HTMLDialogElement>(null);
    const titleId = useId();
    const [session, setSession] = useState(0);

    return (
        <>
            <Button type="button" aria-haspopup="dialog" onClick={event => {
                if (dialog.current) openAnimatedDialog(dialog.current, event.currentTarget);
            }} className="min-h-10 border border-j-gray-300 bg-j-white px-4 py-1 text-sm text-j-blue-800 hover:bg-j-gray-100 hover:text-j-blue-800 focus-visible:bg-j-gray-100">
                <History size={16} aria-hidden="true" /> Histórico de exclusão
            </Button>
            <dialog ref={dialog} aria-labelledby={titleId} onClose={() => setSession(current => current + 1)}
                className="m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-xl overflow-y-auto rounded-3xl border border-j-gray-200 bg-j-white p-5 text-primary shadow-xl backdrop:bg-black/50 sm:p-6">
                <HistoryForm key={session} titleId={titleId} onClose={() => dialog.current?.close()} />
            </dialog>
        </>
    );
}

function HistoryForm({ titleId, onClose }: { titleId: string; onClose: () => void }) {
    const id = useId();
    const [originalId, setOriginalId] = useState("");
    const [state, submit, isPending] = useActionState(lookup, {});
    const history = isPending ? undefined : state.data;

    return (
        <>
            <header className="flex items-start justify-between gap-4">
                <h2 id={titleId} className="text-xl font-extrabold text-j-blue-800">Histórico de exclusão</h2>
                <ButtonIcon type="button" aria-label="Fechar histórico" onClick={onClose} className="shrink-0 rounded-full bg-j-gray-100 p-2">
                    <X size={20} />
                </ButtonIcon>
            </header>
            <form action={submit} className="mt-5 grid gap-2" aria-busy={isPending}>
                <label htmlFor={id} className="text-sm font-semibold">Código original da definição</label>
                <div className="flex flex-wrap items-end gap-2">
                    <input id={id} name="originalId" type="number" min={1} max={Number.MAX_SAFE_INTEGER} step={1} required
                        value={originalId} onChange={event => setOriginalId(event.target.value)}
                        className="h-10 min-w-32 flex-1 rounded-lg border border-input-border bg-background px-3 text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-input-border-focus" />
                    <Button type="submit" disabled={isPending} className="h-10 px-4 py-0">
                        {isPending ? "Consultando…" : "Consultar"}
                    </Button>
                </div>
            </form>
            {!isPending && state.error && <p role="alert" className="mt-4 text-sm text-j-red-600">{state.error}</p>}
            {history && (
                <div className="mt-5 border-t border-j-gray-200 pt-4" aria-live="polite">
                    <h3 className="break-words text-lg font-bold text-j-blue-800">{history.name}</h3>
                    {history.description && <p className="mt-1 break-words text-sm text-secondary">{history.description}</p>}
                    <dl className="mt-4 grid gap-2 sm:grid-cols-2">
                        {(Object.keys(fields) as (keyof typeof fields)[]).map(key => (
                            <div key={key} className="rounded-lg bg-j-gray-100 p-3">
                                <dt className="text-xs text-secondary">{fields[key]}</dt>
                                <dd className="break-words text-sm font-semibold">
                                    {key === "deletedByUserName"
                                        ? history.deletedByUserName?.trim() || "Nome indisponível"
                                        : key === "reason" && history.reason === "ADMINISTRATIVE_DELETE"
                                            ? "Exclusão administrativa"
                                            : displayBillingValue(key, history[key])}
                                </dd>
                            </div>
                        ))}
                    </dl>
                </div>
            )}
        </>
    );
}
