"use client";
import { useModal } from "@/providers/ModalProvider";
import { getChargeDefinitionAction } from "@/server/actions/billing/chargeDefinitions/get";
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { displayBillingValue } from "./billingDisplay";

const fields = {
    name: "Nome da cobrança",
    status: "Situação",
    defaultAmount: "Valor padrão",
    description: "Descrição",
    recurrenceType: "Recorrência",
    required: "Obrigatória",
    paymentAcceptancePolicy: "Política de pagamento",
    latePaymentGraceDays: "Tolerância (dias)",
    createdAt: "Criada em",
    updatedAt: "Atualizada em",
    archivedAt: "Arquivada em",
} as const;

export function ChargeDefinitionDetailsModal({ id }: { id: number }) {
    const { setClose } = useModal();
    const { data, error, isLoading } = useQuery({
        queryKey: ["billing", "charge-definitions", id],
        queryFn: () => getChargeDefinitionAction(id),
    });

    return (
        <section role="dialog" aria-modal="true" aria-label="Detalhamento da cobrança" className="max-h-[90dvh] w-full max-w-xl overflow-auto rounded-l-3xl bg-j-white p-6">
            <header className="flex items-start justify-between gap-4">
                <h2 className="text-xl font-bold text-j-blue-800">Detalhamento da cobrança</h2>
                <button type="button" aria-label="Fechar visualização" onClick={setClose} className="shrink-0 cursor-pointer rounded-full bg-j-gray-100 p-2 text-j-gray-600 transition-colors hover:bg-j-gray-200 hover:text-j-blue-800 focus-visible:outline-2">
                    <X size={20} aria-hidden="true" />
                </button>
            </header>
            {isLoading && <p role="status" className="py-5">Carregando...</p>}
            {error && <p role="alert" className="py-5 text-red-600">{error.message}</p>}
            {data && <dl className="my-5 grid gap-3 sm:grid-cols-2">
                {(Object.keys(fields) as (keyof typeof fields)[]).map(key => {
                    const value = data[key];
                    return value == null ? null : (
                        <div key={key} className="min-w-0 rounded-xl bg-j-gray-100 p-3">
                            <dt className="text-xs text-j-gray-600">{fields[key]}</dt>
                            <dd className="break-words text-sm font-semibold">{displayBillingValue(key, value)}</dd>
                        </div>
                    );
                })}
            </dl>}
        </section>
    );
}
