"use client";
import { Button } from "@/components/common/button";
import { Table } from "@/components/common/table";
import { useModal } from "@/providers/ModalProvider";
import type { BillingRecord,BillingResource } from "@/schemas/billing/management";
import { listChargeDefinitionsAction } from "@/server/actions/billing/chargeDefinitions/list";
import { getChargeDefinitionAction } from "@/server/actions/billing/chargeDefinitions/get";
import PaymentReceiptDialog from "@/components/pages/admin/payments/PaymentReceiptDialog";
import { listAdminUsersAction } from "@/server/actions/admin/users/list";
import { listBillingAction } from "@/server/actions/billing/management";
import { useUserStore } from "@/stores/userStore";
import { hasPermission } from "@/utils/permission/hasPermission";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { BillingExport } from "./BillingExport";
import { BillingRecordModal } from "./BillingRecordModal";
import { GenerateChargeCycleModal } from "./GenerateChargeCycleModal";
import { Check, CircleDollarSign, Eye, LoaderCircle, Plus, X } from "lucide-react";
import { billingLabels, displayBillingValue, linkedChargeLabel } from "./billingDisplay";


const config = {
    cycles: { title: "Ciclos de cobrança", read: "CHARGE_CYCLE_READ", statuses: ["GENERATED", "CANCELED", "FINISHED", "ARCHIVED"] },
    "member-charges": { title: "Cobranças dos associados", read: "MEMBER_CHARGE_READ", statuses: ["PENDING", "PAID", "CANCELED"] },
    payments: { title: "Pagamentos", read: "PAYMENT_READ", statuses: ["PENDING_VALIDATION", "CONFIRMED", "REJECTED", "CANCELED"] },
    refunds: { title: "Reembolsos", read: "REFUND_READ", statuses: ["ELIGIBLE", "REQUESTED", "APPROVED", "REJECTED", "REFUNDED", "EXPIRED", "CANCELED"] },
};

const paymentStatusColors = {
    CONFIRMED: {
        card: "border-(--success-border) bg-(--success-surface)",
        badge: "border-(--success-border) bg-background text-(--success-text)",
        icon: "bg-emerald-500 text-emerald-950",
    },
    PENDING_VALIDATION: {
        card: "border-amber-300 bg-amber-50 [:root[data-theme=dark]_&]:border-amber-300/40 [:root[data-theme=dark]_&]:bg-amber-300/10",
        badge: "border-amber-300 bg-amber-100 text-amber-900 [:root[data-theme=dark]_&]:border-amber-300/40 [:root[data-theme=dark]_&]:bg-amber-300/10 [:root[data-theme=dark]_&]:text-amber-200",
        icon: "bg-amber-400 text-amber-950",
    },
    REJECTED: {
        card: "border-red-200 bg-red-50 [:root[data-theme=dark]_&]:border-red-300/40 [:root[data-theme=dark]_&]:bg-red-300/10",
        badge: "border-red-200 bg-red-100 text-red-900 [:root[data-theme=dark]_&]:border-red-300/40 [:root[data-theme=dark]_&]:bg-red-300/10 [:root[data-theme=dark]_&]:text-red-200",
        icon: "bg-red-400 text-red-950",
    },
    CANCELED: {
        card: "border-input-border bg-background-secondary",
        badge: "border-input-border bg-background text-secondary",
        icon: "bg-sky-400 text-sky-950",
    },
};

export function BillingOperations({ resource, initialStatus }: { resource: BillingResource; initialStatus?: string }) {
    const permissions = useUserStore((state) => state.permissions);
    const can = (action: string) => hasPermission(permissions, "BILLING", action);
    const { setContent, setOpen, openFromTrigger } = useModal();
    const [openedAt] = useState(() => Date.now());
    const [page, setPage] = useState(0);
    const [size, setSize] = useState(resource === "member-charges" ? 12 : 10);
    const [status, setStatus] = useState(initialStatus && config[resource].statuses.includes(initialStatus) ? initialStatus : "");
    const [definitionId, setDefinitionId] = useState("");
    const [membershipNumber, setMembershipNumber] = useState("");
    const [cycleId, setCycleId] = useState("");
    const settings = config[resource];
    const description = {
        cycles: "Gere e consulte os ciclos das cobranças do clube.",
        "member-charges": "Consulte cobranças pela matrícula do associado.",
        payments: "Consulte pagamentos e acompanhe a validação dos comprovantes.",
        refunds: "Consulte reembolsos por situação ou ciclo de cobrança.",
    }[resource];
    const definitions = useQuery({ queryKey: ["billing", "charge-definitions", "selector"], queryFn: () => listChargeDefinitionsAction({ page: "0", size: "50" }), enabled: resource === "cycles" && can("CHARGE_DEFINITION_READ") });
    const selectedDefinition = useQuery({ queryKey: ["billing", "charge-definitions", "cycle-selection", definitionId], queryFn: () => getChargeDefinitionAction(Number(definitionId)), enabled: resource === "cycles" && can("CHARGE_DEFINITION_READ") && Number(definitionId) > 0 });
    const canFindMember = hasPermission(permissions, "IDENTITY", "USER_READ");
    const member = useQuery({
        queryKey: ["billing", "member-by-number", membershipNumber],
        queryFn: () => listAdminUsersAction({ membershipNumber, page: "0", size: "1" }),
        enabled: resource === "member-charges" && canFindMember && /^[1-9]\d*$/.test(membershipNumber),
        retry: false,
    });
    const userId = member.data?.content[0]?.id;
    const filters = { page, size, ...(resource === "cycles" && definitionId ? { definitionId: Number(definitionId) } : {}), ...(resource === "member-charges" && userId ? { userId } : {}), ...(resource === "refunds" && cycleId ? { cycleId: Number(cycleId) } : {}), ...(status ? { status } : {}) };
    const validFilters = (!membershipNumber || userId !== undefined) && (!cycleId || Number(cycleId) > 0) && (!definitionId || Number(definitionId) > 0);
    const records = useQuery({ queryKey: ["billing", resource, filters], queryFn: () => listBillingAction(resource, filters), enabled: can(settings.read) && validFilters && (resource !== "cycles" || Number(definitionId) > 0), placeholderData: membershipNumber ? undefined : (previous) => previous });
    function open(trigger: HTMLButtonElement, id: number, title: string, operation?: string, explanation?: string) {
        setContent(<BillingRecordModal resource={resource} id={id} title={title} operation={operation} explanation={explanation} />);
        openFromTrigger(trigger);
    }
    function renderActions(item: BillingRecord) {
        const actions: { title: string; operation: string; explanation: string }[] = [];
        const add = (allowed: boolean, permission: string, title: string, operation: string, explanation: string) => { if (allowed && can(permission)) actions.push({ title, operation, explanation }); };
        if (resource === "cycles") {
            add(item.status === "GENERATED", "CHARGE_CYCLE_CANCEL", "Cancelar ciclo", "cancel", "Cancela as cobranças abertas e cria elegibilidade de reembolso para pagamentos confirmados. Confira o ciclo antes de confirmar.");
            add(item.status === "GENERATED", "CHARGE_CYCLE_FINISH", "Finalizar ciclo", "finish", "Finalizar organiza o ciclo e não quita nem cancela suas cobranças.");
            add(["FINISHED", "CANCELED"].includes(item.status), "CHARGE_CYCLE_ARCHIVE", "Arquivar ciclo", "archive", "Arquiva o histórico do ciclo. Não altera os pagamentos.");
        } else if (resource === "member-charges") {
            add(item.status === "PENDING" && "effectiveStatus" in item && item.effectiveStatus !== "EXPIRED", "MEMBER_CHARGE_UPDATE", "Ajustar valor", "final-amount", "Altera somente o valor desta cobrança.");
            add(item.status === "PENDING", "MEMBER_CHARGE_CANCEL", "Isentar cobrança", "cancel", "");
        } else if (resource === "payments") {
            add(item.status === "PENDING_VALIDATION", "PAYMENT_CONFIRM", "Confirmar pagamento", "confirm", "Confirme após conferir o comprovante e o recebimento. A cobrança será quitada; ciclos cancelados seguem as regras de reembolso.");
            add(item.status === "PENDING_VALIDATION", "PAYMENT_REJECT", "Rejeitar pagamento", "reject", "Informe o motivo para permitir que o associado corrija o pagamento.");
        } else {
            const until = "eligibleUntil" in item ? item.eligibleUntil : null;
            const expired = !!until && new Date(until).getTime() < Math.max(openedAt, records.dataUpdatedAt);
            add(item.status === "REQUESTED" || item.status === "ELIGIBLE" && !expired, "REFUND_APPROVE", "Aprovar reembolso", "approve", "Aprova a solicitação. O registro como realizado deve ocorrer após a devolução.");
            add(item.status === "REQUESTED", "REFUND_REJECT", "Rejeitar reembolso", "reject", "Informe o motivo da rejeição.");
            add(item.status === "APPROVED", "REFUND_MARK_AS_REFUNDED", "Registrar devolução", "mark-as-refunded", "Confirme somente se o dinheiro já foi devolvido ao associado. Esta ação registra a devolução.");
            add(item.status === "ELIGIBLE" && expired, "REFUND_EXPIRE", "Expirar elegibilidade", "expire", "Registra o encerramento da janela de elegibilidade.");
            add(["ELIGIBLE", "REQUESTED", "APPROVED"].includes(item.status), "REFUND_CANCEL", "Cancelar reembolso", "cancel", "Encerra este processo de reembolso.");
        }
        const isPayment = resource === "payments";
        const isRefund = resource === "refunds";
        const actionClass = "flex min-h-10 min-w-0 cursor-pointer items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-bold focus-visible:outline-2 focus-visible:outline-offset-2";
        const neutralClass = actionClass + " border border-input-border hover:bg-background-tertiary";
        return <div className={isPayment || isRefund ? `grid w-full grid-cols-2 gap-2 ${isRefund ? "[&>button:first-child]:col-span-2" : ""}` : "flex flex-wrap justify-end gap-2"}>
            <button type="button" aria-haspopup="dialog" className={neutralClass + " text-primary"} onClick={event => open(event.currentTarget, item.id, "Detalhes")}>
                {(isPayment || isRefund) && <Eye size={15} className="shrink-0" aria-hidden="true" />}Detalhes
            </button>
            {isPayment && "receiptUrl" in item && item.receiptUrl && <PaymentReceiptDialog paymentId={item.id} />}
            {actions.map(action => {
                const isDestructive = action.operation === "reject" || (isRefund && action.operation === "cancel");
                const Icon = isDestructive ? X : Check;
                return <button
                    key={action.operation}
                    type="button"
                    aria-haspopup="dialog"
                    aria-label={action.title}
                    className={isDestructive
                        ? neutralClass + " text-j-red-700 [:root[data-theme=dark]_&]:text-red-300"
                        : actionClass + " bg-j-blue-800 text-white hover:bg-j-blue-900 [:root[data-theme=dark]_&]:bg-j-yellow-300 [:root[data-theme=dark]_&]:text-[#061e50] [:root[data-theme=dark]_&]:hover:bg-yellow-200"}
                    onClick={event => open(event.currentTarget, item.id, action.title, action.operation, action.explanation)}
                >
                    {(isPayment || isRefund) && <Icon size={15} className="shrink-0" aria-hidden="true" />}
                    {isPayment ? action.title.replace(" pagamento", "") : isRefund ? action.title.replace(" reembolso", "") : action.title}
                </button>;
            })}
        </div>;
    }
    const change = (setter: (value: string) => void, value: string) => { setter(value); setPage(0); };
    if (!can(settings.read)) return <p className="rounded-xl bg-j-white p-6">Seu usuário não possui permissão para consultar {settings.title.toLowerCase()}.</p>;
    const exportFilters: Record<string, string> = {};
    if (status) exportFilters.status = status;
    if (resource === "cycles" && definitionId) exportFilters.chargeDefinitionId = definitionId;
    if (resource === "member-charges" && userId) exportFilters.userId = String(userId);
    if (resource === "refunds" && cycleId) exportFilters.chargeCycleId = cycleId;
    const controlClassName = "mt-1.5 block h-11 w-full rounded-xl border border-j-gray-300 bg-j-white px-3 text-sm font-medium text-j-blue-800 outline-none transition-colors placeholder:text-j-gray-400 hover:border-j-gray-400 focus:border-j-blue-500 focus:ring-2 focus:ring-j-blue-100";
    return <section className="flex flex-col gap-4">
        <div className="rounded-2xl border border-j-gray-200 bg-j-white shadow-sm">
            <Table.Header title={settings.title} description={description} className="gap-3 lg:flex-wrap lg:items-start">
                {((can("EXPORT") && validFilters) || (resource === "cycles" && can("CHARGE_CYCLE_GENERATE"))) && <div className="flex w-full flex-wrap items-center gap-2 xl:w-auto xl:justify-end">
                    {can("EXPORT") && validFilters && <BillingExport kind={resource} filters={exportFilters} />}
                    {resource === "cycles" && can("CHARGE_CYCLE_GENERATE") && <div className="flex w-full sm:w-auto">
                        <Button type="button" className="h-10 w-full shrink-0 whitespace-nowrap px-4 py-0 text-sm sm:w-auto" disabled={!selectedDefinition.data || selectedDefinition.data.status !== "ACTIVE" || selectedDefinition.isFetching} onClick={() => { if (selectedDefinition.data) { setContent(<GenerateChargeCycleModal chargeDefinitionId={selectedDefinition.data.id} chargeDefinitionName={selectedDefinition.data.name} />); setOpen(); } }}><Plus size={16} strokeWidth={3} />Criar ciclo</Button>
                    </div>}
                </div>}
            </Table.Header>
            <div className={`grid grid-cols-1 items-end gap-3 p-4 md:px-6 ${resource === "cycles" || resource === "payments" ? "" : "sm:grid-cols-2"}`}>
                {resource === "cycles" && <label className="block min-w-0 text-xs font-bold text-j-blue-800"><span className="flex min-h-4 items-center justify-between gap-2"><span>1. Selecione a cobrança <span className="font-semibold text-j-red-500">*</span></span></span><select aria-label="Selecione a cobrança que deseja gerar" value={definitionId} onChange={(event) => change(setDefinitionId, event.target.value)} className={controlClassName}><option value="">Escolha uma cobrança ativa</option>{definitions.data?.content.filter((definition) => definition.status === "ACTIVE").map((definition) => <option key={definition.id} value={definition.id}>{definition.name}</option>)}</select></label>}
                {resource === "member-charges" && canFindMember && <label className="block min-w-0 text-xs font-bold text-j-gray-600">Matrícula do associado<input inputMode="numeric" value={membershipNumber} onChange={(event) => change(setMembershipNumber, event.target.value.replace(/\D/g, "").replace(/^0+/, ""))} className={controlClassName} /></label>}
                {resource !== "cycles" && !(resource === "refunds" && cycleId) && <label className="block min-w-0 text-xs font-bold text-j-gray-600">Situação<select value={status} onChange={(event) => change(setStatus, event.target.value)} className={controlClassName}><option value="">Todas</option>{settings.statuses.map((value) => <option key={value} value={value}>{billingLabels[value]}</option>)}</select></label>}
                {resource === "refunds" && <label className="block min-w-0 text-xs font-bold text-j-gray-600">Código do ciclo<input type="number" min="1" value={cycleId} onChange={(event) => { change(setCycleId, event.target.value); setStatus(""); }} className={controlClassName} /></label>}
            </div>
            {membershipNumber && !userId && <p role="status" className="px-4 pb-4 text-sm text-secondary">{member.isFetching ? "Buscando matrícula…" : member.isError ? "Não foi possível consultar a matrícula." : "Nenhum associado encontrado com essa matrícula."}</p>}
        </div>
        {definitions.error && resource === "cycles" && <p role="alert" className="text-red-600">{definitions.error.message}</p>}
        {!validFilters ? (membershipNumber ? null : <p role="alert">Informe códigos maiores que zero.</p>)
            : resource === "cycles" && !definitionId ? <p className="rounded-xl border border-dashed border-j-gray-300 p-8 text-center">Selecione uma definição para consultar os ciclos gerados.</p>
                : resource === "member-charges" ? <Table.Root
                    data={records.data?.content ?? []}
                    columns={[]}
                    getRowId={(row) => String(row.id)}
                    isLoading={records.isLoading}
                    isFetching={records.isFetching}
                    pagination={{ pageIndex: page, pageSize: size, pageCount: records.data?.totalPages ?? 0, rowCount: records.data?.totalElements, pageSizeOptions: [12, 24, 36, 48], onChange: (next) => { setPage(next.pageIndex); setSize(next.pageSize); } }}
                    footer={<Table.Pagination itemLabel="cobrança" />}
                >
                    {records.isLoading ? <div className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: size }, (_, index) => <div key={index} className="h-64 animate-pulse rounded-2xl border border-j-gray-200 bg-j-gray-100" />)}</div>
                        : records.error ? <div role="alert" className="p-6 text-sm text-j-red-500">{records.error.message}</div>
                            : records.data?.content.length ? <div className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">
                                {records.data.content.map((record) => {
                                    if (!("finalAmount" in record)) return null;
                                    const charge = record;
                                    const statusClass = charge.effectiveStatus === "PAID"
                                        ? "financeiro-status-paid bg-j-green-100 text-j-green-700"
                                        : charge.effectiveStatus === "OVERDUE" || charge.effectiveStatus === "EXPIRED"
                                            ? "bg-j-red-100 text-j-red-700"
                                            : "bg-j-gray-100 text-j-gray-700";
                                    const canAdjust = charge.status === "PENDING" && charge.effectiveStatus !== "EXPIRED" && can("MEMBER_CHARGE_UPDATE");
                                    const canCancel = charge.status === "PENDING" && can("MEMBER_CHARGE_CANCEL");
                                    return <article key={charge.id} className="flex min-w-0 flex-col gap-4 rounded-2xl border border-input-border bg-background-secondary p-4 sm:p-5">
                                        <header className="flex flex-wrap items-start justify-between gap-2">
                                            <h3 className="min-w-0 break-words text-lg font-extrabold text-primary">{charge.chargeDefinitionNameSnapshot || `Cobrança #${charge.id}`}</h3>
                                            <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${statusClass}`}>{billingLabels[charge.effectiveStatus]}</span>
                                        </header>
                                        <div className="flex flex-1 flex-col gap-4 rounded-xl bg-background px-4 py-3.5 text-sm">
                                            <dl className="grid gap-y-3">
                                                {charge.userName && <div className="grid gap-0.5"><dt className="text-xs text-secondary">Titular</dt><dd className="break-words font-semibold text-primary">{charge.userName}</dd></div>}
                                                {charge.membershipNumber && <div className="flex flex-wrap items-baseline gap-x-2"><dt className="text-xs text-secondary">Matrícula</dt><dd className="break-all font-semibold text-primary">{charge.membershipNumber}</dd></div>}
                                                <div className="grid gap-0.5"><dt className="text-xs text-secondary">Ciclo</dt><dd className="break-words font-semibold text-primary">{charge.chargeCycleCode || `#${charge.chargeCycleId}`}</dd></div>
                                            </dl>
                                            <dl className="mt-auto grid grid-cols-2 gap-3 border-t border-input-border pt-3">
                                                <div className="min-w-0"><dt className="text-xs text-secondary">Valor</dt><dd className="break-words font-extrabold text-primary">{displayBillingValue("finalAmount", charge.finalAmount)}</dd></div>
                                                <div className="min-w-0"><dt className="text-xs text-secondary">Vencimento</dt><dd className="break-words font-semibold text-primary">{displayBillingValue("dueDate", charge.dueDate)}</dd></div>
                                            </dl>
                                        </div>
                                        <footer className="flex flex-wrap gap-2">
                                            <button type="button" aria-haspopup="dialog" className="flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-input-border px-3 py-2 text-xs font-bold text-primary hover:bg-background-tertiary focus-visible:outline-2 focus-visible:outline-offset-2" onClick={event => open(event.currentTarget, charge.id, "Detalhes")}><Eye size={15} aria-hidden="true" />Detalhes</button>
                                            {canAdjust && <button className="min-h-9 flex-1 rounded-lg bg-j-blue-800 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-j-blue-900" onClick={event => open(event.currentTarget, charge.id, "Ajustar valor", "final-amount", "Altera somente o valor desta cobrança.")}>Ajustar valor</button>}
                                            {canCancel && <button type="button" aria-haspopup="dialog" className="min-h-9 flex-1 rounded-lg border px-3 py-2 text-xs font-bold transition-colors bg-red-700 text-white border-red-700 hover:bg-red-800 hover:text-white hover:border-red-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:bg-red-800 focus-visible:text-white cursor-pointer" onClick={event => open(event.currentTarget, charge.id, "Isentar cobrança", "cancel")}>Isentar</button>}
                                        </footer>
                                    </article>;
                                })}
                            </div>
                                : <p className="p-8 text-center text-sm text-j-gray-600">Nenhuma cobrança encontrada para os filtros informados.</p>}
                </Table.Root>
                    : <Table.Root data={records.data?.content ?? []} columns={[]} getRowId={(row) => String(row.id)} isLoading={records.isLoading} isFetching={records.isFetching} pagination={{ pageIndex: page, pageSize: size, pageCount: records.data?.totalPages ?? 0, rowCount: records.data?.totalElements, pageSizeOptions: [5, 10, 20, 50], onChange: (next) => { setPage(next.pageIndex); setSize(next.pageSize); } }} footer={<Table.Pagination itemLabel={resource === "payments" ? "pagamento" : "registro"} />}>{resource === "cycles" && <Table.Header title={settings.title} />}{resource === "payments" ? (
                        <div className="p-4 md:px-6" aria-busy={records.isFetching}>
                            {records.isLoading ? <p role="status" className="flex items-center gap-2 py-6 text-sm text-secondary"><LoaderCircle size={17} aria-hidden="true" className="motion-safe:animate-spin" />Carregando pagamentos...</p>
                                : records.error ? <div role="alert" className="space-y-3 py-4 text-sm text-input-error-text"><p>{records.error.message}</p><Button type="button" onClick={() => void records.refetch()}>Tentar novamente</Button></div>
                                    : records.data?.content.length ? <ul className="grid auto-rows-fr gap-4 lg:grid-cols-2 2xl:grid-cols-3">
                                        {records.data.content.map((payment) => {
                                            if (!("paymentMethod" in payment)) return null;
                                            const colors = paymentStatusColors[payment.status];
                                            return <li key={payment.id} className="min-w-0">
                                                <article className={`flex h-full flex-col gap-4 rounded-2xl border p-4 ${colors.card}`}>
                                                    <header className="flex flex-wrap items-center justify-between gap-3">
                                                        <div className="flex items-center gap-3">
                                                            <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${colors.icon}`}><CircleDollarSign size={21} aria-hidden="true" /></span>
                                                            <p className="text-xl font-extrabold text-primary">{displayBillingValue("amount", payment.amount)}</p>
                                                        </div>
                                                        <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${colors.badge}`}>{displayBillingValue("status", payment.status)}</span>
                                                    </header>
                                                    <div className="flex flex-1 flex-col gap-4 rounded-xl bg-background px-4 py-3.5 text-sm">
                                                        <dl className="grid gap-y-3">
                                                            <div className="grid min-w-0 gap-0.5"><dt className="text-xs text-secondary">Cobrança</dt><dd className="break-words font-semibold text-primary">{linkedChargeLabel(payment)}</dd></div>
                                                            {payment.userName && <div className="grid min-w-0 gap-0.5"><dt className="text-xs text-secondary">Titular</dt><dd className="break-words font-semibold text-primary">{payment.userName}</dd></div>}
                                                            {payment.membershipNumber && <div className="flex flex-wrap items-baseline gap-x-2"><dt className="text-xs text-secondary">Matrícula</dt><dd className="break-all font-semibold text-primary">{payment.membershipNumber}</dd></div>}
                                                            {(payment.chargeCycleCode || payment.chargeCycleId) && <div className="grid min-w-0 gap-0.5"><dt className="text-xs text-secondary">Ciclo</dt><dd className="break-words font-semibold text-primary">{payment.chargeCycleCode || `#${payment.chargeCycleId}`}</dd></div>}
                                                        </dl>
                                                        <dl className="mt-auto grid grid-cols-2 gap-3 border-t border-input-border pt-3">
                                                            <div className="min-w-0"><dt className="text-xs text-secondary">Forma</dt><dd className="break-words font-semibold text-primary">{displayBillingValue("paymentMethod", payment.paymentMethod)}</dd></div>
                                                            {payment.dueDate && <div className="min-w-0"><dt className="text-xs text-secondary">Vencimento</dt><dd className="font-semibold text-primary">{displayBillingValue("dueDate", payment.dueDate)}</dd></div>}
                                                            <div className="col-span-2"><dt className="text-xs text-secondary">Pago em</dt><dd className="font-semibold text-primary">{displayBillingValue("paidAt", payment.paidAt)}</dd></div>
                                                        </dl>
                                                    </div>
                                                    <footer className="border-t border-input-border pt-3">{renderActions(payment)}</footer>
                                                </article>
                                            </li>;
                                        })}
                                    </ul> : <p className="rounded-xl border border-dashed border-input-border p-6 text-center text-sm text-secondary">{status ? "Nenhum pagamento encontrado para esta situação." : "Nenhum pagamento registrado. Os comprovantes enviados pelos associados aparecerão aqui."}</p>}
                        </div>
                    ) : resource === "refunds" ? (
                        <div className="p-4 md:px-6" aria-busy={records.isFetching}>
                            {records.isLoading ? <p role="status" className="flex items-center gap-2 py-6 text-sm text-secondary"><LoaderCircle size={17} aria-hidden="true" className="motion-safe:animate-spin" />Carregando reembolsos...</p>
                                : records.error ? <div role="alert" className="space-y-3 py-4 text-sm text-input-error-text"><p>{records.error.message}</p><Button type="button" onClick={() => void records.refetch()}>Tentar novamente</Button></div>
                                    : records.data?.content.length ? <ul className="grid auto-rows-fr gap-4 sm:grid-cols-2 xl:grid-cols-3">
                                        {records.data.content.map(refund => {
                                            if (!("memberPaymentId" in refund)) return null;
                                            return <li key={refund.id} className="min-w-0">
                                                <article className="flex h-full flex-col gap-4 rounded-2xl border border-input-border bg-background-secondary p-4">
                                                    <header className="flex flex-wrap items-start justify-between gap-2">
                                                        <div className="min-w-0">
                                                            <h3 className="break-words text-base font-bold text-primary">{refund.chargeDefinitionNameSnapshot || "Reembolso"}</h3>
                                                            <p className="mt-1 text-xl font-extrabold text-primary">{displayBillingValue("amount", refund.amount)}</p>
                                                        </div>
                                                        <span className="rounded-full border border-input-border bg-background px-2.5 py-1 text-xs font-semibold text-primary">{displayBillingValue("status", refund.status)}</span>
                                                    </header>
                                                    <dl className="grid flex-1 grid-cols-2 gap-3 rounded-xl bg-background px-4 py-3.5 text-sm">
                                                        {!refund.chargeDefinitionNameSnapshot && <div className="col-span-2 min-w-0"><dt className="text-xs text-secondary">Cobrança</dt><dd className="font-semibold text-primary">#{refund.memberChargeId}</dd></div>}
                                                        {refund.userName && <div className="col-span-2 min-w-0"><dt className="text-xs text-secondary">Beneficiário</dt><dd className="break-words font-semibold text-primary">{refund.userName}</dd></div>}
                                                        {refund.membershipNumber && <div className="col-span-2 flex flex-wrap items-baseline gap-x-2"><dt className="text-xs text-secondary">Matrícula</dt><dd className="break-all font-semibold text-primary">{refund.membershipNumber}</dd></div>}
                                                        {refund.chargeCycleCode && <div className="col-span-2 min-w-0"><dt className="text-xs text-secondary">Ciclo</dt><dd className="break-words font-semibold text-primary">{refund.chargeCycleCode}</dd></div>}
                                                        <div className="border-t border-input-border pt-3"><dt className="text-xs text-secondary">Pagamento</dt><dd className="font-semibold text-primary">#{refund.memberPaymentId}</dd></div>
                                                        {refund.eligibleUntil && <div className="min-w-0 border-t border-input-border pt-3"><dt className="text-xs text-secondary">Elegível até</dt><dd className="font-semibold text-primary">{displayBillingValue("eligibleUntil", refund.eligibleUntil)}</dd></div>}
                                                    </dl>
                                                    <footer className="border-t border-input-border pt-3">{renderActions(refund)}</footer>
                                                </article>
                                            </li>;
                                        })}
                                    </ul> : <p className="rounded-xl border border-dashed border-input-border p-6 text-center text-sm text-secondary">Nenhum reembolso encontrado para os filtros informados.</p>}
                        </div>
                    ) : (
                        <div className="p-4 md:px-6" aria-busy={records.isFetching}>
                            {records.isLoading ? <p role="status" className="flex items-center gap-2 py-6 text-sm text-secondary"><LoaderCircle size={17} aria-hidden="true" className="motion-safe:animate-spin" />Carregando ciclos...</p>
                                : records.error ? <div role="alert" className="space-y-3 py-4 text-sm text-input-error-text"><p>{records.error.message}</p><Button type="button" onClick={() => void records.refetch()}>Tentar novamente</Button></div>
                                    : records.data?.content.length ? <ul className="grid auto-rows-fr gap-4 sm:grid-cols-2 xl:grid-cols-3">
                                        {records.data.content.map(cycle => {
                                            if (!("code" in cycle)) return null;
                                            return <li key={cycle.id} className="min-w-0">
                                                <article className="flex h-full flex-col gap-4 rounded-2xl border border-input-border bg-background-secondary p-4">
                                                    <header className="flex flex-wrap items-start justify-between gap-2">
                                                        <div className="min-w-0">
                                                            <p className="text-xs font-semibold text-secondary">Ciclo #{cycle.id}</p>
                                                            <h3 className="mt-1 break-words text-lg font-extrabold text-primary">{cycle.code}</h3>
                                                        </div>
                                                        <span className="rounded-full border border-input-border bg-background px-2.5 py-1 text-xs font-semibold text-primary">{displayBillingValue("status", cycle.status)}</span>
                                                    </header>
                                                    <dl className="grid flex-1 grid-cols-2 gap-3 rounded-xl bg-background p-3 text-sm">
                                                        <div className="min-w-0"><dt className="text-xs text-secondary">Definição</dt><dd className="break-words font-semibold text-primary">{cycle.chargeDefinitionNameSnapshot}</dd></div>
                                                        <div><dt className="text-xs text-secondary">Vencimento</dt><dd className="font-semibold text-primary">{displayBillingValue("dueDate", cycle.dueDate)}</dd></div>
                                                    </dl>
                                                    <footer className="border-t border-input-border pt-3">{renderActions(cycle)}</footer>
                                                </article>
                                            </li>;
                                        })}
                                    </ul> : <p className="rounded-xl border border-dashed border-input-border p-6 text-center text-sm text-secondary">Nenhum ciclo gerado para esta cobrança.</p>}
                        </div>
                    )}</Table.Root>}
    </section>;
}
