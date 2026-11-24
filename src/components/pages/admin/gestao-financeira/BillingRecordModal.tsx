"use client";
import { Button } from "@/components/common/button";
import { ConfirmButton } from "@/components/common/button/ConfirmButton";
import { useModal } from "@/providers/ModalProvider";
import type { BillingRecord, BillingResource } from "@/schemas/billing/management";
import { getBillingAction,mutateBillingAction } from "@/server/actions/billing/management";
import { useMutation,useQuery,useQueryClient } from "@tanstack/react-query";
import { TriangleAlert, X } from "lucide-react";
import { useId,useState } from "react";
import toast from "react-hot-toast";
import { displayBillingValue,fieldLabels } from "./billingDisplay";

const preferredFields: Record<string, string> = {
    chargeDefinitionId: "chargeDefinitionNameSnapshot",
    chargeCycleId: "chargeCycleCode",
    confirmedByUserId: "confirmedByUserName",
    createdByUserId: "createdByUserName",
    requestedByUserId: "requestedByUserName",
    approvedByUserId: "approvedByUserName",
    rejectedByUserId: "rejectedByUserName",
    refundedByUserId: "refundedByUserName",
    canceledByUserId: "canceledByUserName",
};

const primaryFields: Record<BillingResource, readonly string[]> = {
    payments: ["chargeDefinitionNameSnapshot", "chargeCycleCode", "paidAt", "dueDate", "amount", "status", "paymentMethod", "userName", "membershipNumber", "rejectionReason", "notes"],
    "member-charges": ["chargeDefinitionNameSnapshot", "chargeCycleCode", "dueDate", "paidAt", "finalAmount", "effectiveStatus", "status", "userName", "membershipNumber", "originalAmount", "paymentAllowedUntil"],
    cycles: ["code", "chargeDefinitionNameSnapshot", "dueDate", "status", "chargeDefinitionDefaultAmountSnapshot", "generatedAt"],
    refunds: ["chargeDefinitionNameSnapshot", "chargeCycleCode", "eligibleUntil", "refundedAt", "amount", "status", "userName", "membershipNumber", "reason", "rejectionReason"],
};

const detailTitles: Record<BillingResource, string> = {
    payments: "Detalhes do pagamento",
    "member-charges": "Detalhes da cobrança",
    cycles: "Detalhes do ciclo",
    refunds: "Detalhes do reembolso",
};

const detailFieldLabels: Record<string, string> = {
    chargeDefinitionNameSnapshot: "Cobrança",
    chargeCycleCode: "Ciclo",
    code: "Ciclo",
};

function visibleFields(record: BillingRecord, resource: BillingResource) {
    const fields = record as Record<string, unknown>;
    const order = primaryFields[resource];
    const rank = (key: string) => {
        const position = order.indexOf(key);
        if (position !== -1) return position;
        return key === "id" || key.endsWith("Id") ? order.length + 1 : order.length;
    };

    return Object.entries(fields)
        .filter(([key, value]) => value != null && fieldLabels[key]
            && !(resource === "refunds" && (key === "id" || key === "chargeCycleId"))
            && !fields[preferredFields[key]])
        .sort(([left], [right]) => rank(left) - rank(right));
}

export function BillingRecordModal({ resource, id, operation, title, explanation }: { resource: BillingResource; id: number; operation?: string; title: string; explanation?: string }) {
    const { setClose } = useModal();
    const client = useQueryClient();
    const explanationId = useId();
    const isWaiver = resource === "member-charges" && operation === "cancel";
    const [value, setValue] = useState("");
    const [failure, setFailure] = useState<string>();
    const details = useQuery({ queryKey: ["billing", resource, id], queryFn: () => getBillingAction(resource, id) });
    const mutation = useMutation({
        mutationFn: () => mutateBillingAction(resource, id, operation!, value),
        onSuccess: async updated => {
            const detailKey = ["billing", resource, id];
            await client.cancelQueries({ queryKey: detailKey, exact: true });
            client.setQueryData(detailKey, updated);
            void client.invalidateQueries({ queryKey: ["billing"] });
            toast.success(isWaiver ? "Cobrança isentada." : "Operação concluída.");
            setClose();
        },
        onError: (error) => setFailure(error.message),
    });
    const isAmount = operation === "final-amount";
    const isRejection = operation === "reject";
    const originalAmount = details.data && "originalAmount" in details.data ? details.data.originalAmount : undefined;
    const waiverAmount = isWaiver && details.data && "finalAmount" in details.data ? details.data.finalAmount : undefined;
    const valid = !isAmount && !isRejection || (isRejection ? value.trim().length > 0 && value.trim().length <= 500 : Number(value) >= 0.01 && (originalAmount == null || Number(value) <= originalAmount));
    const canConfirm = valid && Boolean(details.data) && (!isWaiver || waiverAmount !== undefined) && !mutation.isPending;
    const heading = operation ? title : detailTitles[resource];
    const recordFields = details.data as Record<string, unknown> | undefined;
    const hasDescription = isWaiver ? waiverAmount !== undefined : Boolean(explanation);
    return <section role="dialog" aria-modal="true" aria-label={heading} aria-describedby={hasDescription ? explanationId : undefined} className={`flex max-h-[90dvh] w-full flex-col overflow-y-auto rounded-3xl bg-j-white p-6 shadow-xl ${isWaiver ? "max-w-lg gap-4" : "max-w-2xl"}`}>
        <header className="flex items-start justify-between gap-4"><h2 className="text-xl font-extrabold text-j-blue-800">{heading}{operation && resource !== "refunds" && ` #${id}`}</h2><button type="button" aria-label="Fechar" disabled={mutation.isPending} onClick={setClose} className="shrink-0 rounded-full bg-j-gray-100 p-2 text-j-gray-600 transition-colors hover:bg-j-gray-200 hover:text-j-blue-800"><X size={20} /></button></header>
        {isWaiver && waiverAmount !== undefined && <div id={explanationId} className="space-y-3 text-sm text-primary">
            <p>Você quer isentar o associado da cobrança <strong>#{id}</strong>, no valor de <strong>{displayBillingValue("finalAmount", waiverAmount)}</strong>?</p>
            <div className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-amber-950 [:root[data-theme=dark]_&]:border-amber-300/40 [:root[data-theme=dark]_&]:bg-amber-300/10 [:root[data-theme=dark]_&]:text-amber-200">
                <TriangleAlert size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
                <p><strong>Esta ação é irreversível.</strong> Após a isenção, a cobrança não poderá mais ser cobrada nem paga.</p>
            </div>
        </div>}
        {!isWaiver && explanation && <p id={explanationId} className="mt-4 text-sm text-j-gray-600">{explanation}</p>}
        {details.isLoading && <p className="py-6" role="status">Carregando detalhes...</p>}
        {details.error && <p role="alert" className="my-4 text-red-600">{details.error.message}</p>}
        {!isWaiver && details.data && (
            <dl className="my-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {visibleFields(details.data, resource).map(([key, value]) => (
                    <div key={key} className="min-w-0 rounded-xl bg-j-gray-100 p-3">
                        <dt className="text-xs text-j-gray-600">{detailFieldLabels[key] ?? fieldLabels[key]}</dt>
                        <dd className="mt-1 whitespace-pre-wrap break-words text-sm font-semibold text-j-blue-800">
                            {String(recordFields?.[`${key}Label`] || displayBillingValue(key, value))}
                        </dd>
                    </div>
                ))}
            </dl>
        )}
        <form onSubmit={(event) => { event.preventDefault(); setFailure(undefined); if (canConfirm) mutation.mutate(); }} className="flex flex-col gap-4">
            {isRejection && <label className="text-sm font-semibold">Motivo da rejeição<textarea required maxLength={500} value={value} onChange={(event) => setValue(event.target.value)} className="mt-2 w-full rounded-xl border border-j-gray-300 p-3" rows={3} /></label>}
            {isAmount && <label className="text-sm font-semibold">Novo valor final (R$)<input required type="number" min="0.01" step="0.01" max={originalAmount} value={value} onChange={(event) => setValue(event.target.value)} className="mt-2 w-full rounded-xl border border-j-gray-300 p-3" /><span className="mt-1 block text-xs font-normal">O valor não pode superar o original. Pagamentos em validação impedem o ajuste.</span></label>}
            {failure && <p role="alert" className="text-sm text-red-600">{failure}</p>}
            {operation && <footer className="flex flex-wrap justify-end gap-3"><Button type="button" disabled={mutation.isPending} onClick={setClose}>Voltar</Button><ConfirmButton type="submit" isLoading={mutation.isPending} disabled={!canConfirm}>{mutation.isPending ? "Processando..." : isWaiver ? "Confirmar isenção" : "Confirmar operação"}</ConfirmButton></footer>}
        </form>
    </section>;
}
