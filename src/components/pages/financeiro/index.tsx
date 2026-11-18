import { CheckCircle2, CalendarDays, CircleAlert, CircleDollarSign, ReceiptText } from "lucide-react";

import { PageHeader } from "@/components/common/page-header";
import { listMyMemberChargesAction } from "@/server/actions/billing/memberCharges/listMine";
import Link from "next/link";
import { FinanceiroFilters } from "./FinanceiroFilters";
import { PaymentReceiptSubmission } from "./PaymentReceiptSubmission";
import { submitMemberPaymentAction } from "@/server/actions/billing/memberPayments/submit";

type FinanceiroSearchParams = {
    status?: string;
    sort?: string;
    page?: string;
};

const STATUS_LABEL: Record<MemberChargeEffectiveStatus, string> = {
    PENDING: "Pendente",
    OVERDUE: "Em atraso",
    EXPIRED: "Expirada",
    PAID: "Paga",
    CANCELED: "Cancelada",
};

const STATUS_STYLE: Record<MemberChargeEffectiveStatus, string> = {
    PENDING: "financeiro-status-pending bg-j-yellow-100 text-j-yellow-700",
    OVERDUE: "financeiro-status-overdue bg-j-red-100 text-j-red-500",
    EXPIRED: "financeiro-status-expired bg-j-gray-200 text-primary",
    PAID: "financeiro-status-paid bg-j-green-100 text-j-green-700",
    CANCELED: "financeiro-status-canceled bg-j-gray-200 text-secondary",
};

function formatCurrency(value: number) {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function formatDate(value: string) {
    return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
}

export default async function Financeiro({
    searchParams = Promise.resolve({}),
}: {
    searchParams?: Promise<FinanceiroSearchParams>;
}) {
    const params = await searchParams;
    const status = ["PENDING", "PAID", "CANCELED"].includes(params.status ?? "")
        ? params.status as MemberChargeStatus
        : undefined;
    const sort = params.sort === "dueDate,asc" ? "dueDate,asc" : "dueDate,desc";
    const requestedPage = Number(params.page);
    const pageNumber = Number.isInteger(requestedPage) && requestedPage >= 0 ? requestedPage : 0;
    let charges: MemberChargeSummary[] = [];
    let totalPages = 0;
    let loadError = false;

    try {
        const page = await listMyMemberChargesAction({
            ...(status ? { status } : {}),
            page: String(pageNumber),
            size: "10",
            sort,
        });
        charges = page.content;
        totalPages = page.totalPages;
    } catch {
        loadError = true;
    }

    return (
        <div className="min-h-full w-full px-3 py-5 pb-10 sm:px-5 lg:px-8">
            <div className="flex w-full flex-col gap-5">
                <PageHeader
                    title="Gestão de débitos"
                    breadcrumbs={[
                        { label: "Home", href: "/feed" },
                        { label: "Gestão de débitos" },
                    ]}
                />

                <section className="overflow-hidden rounded-2xl border border-input-border bg-background shadow-sm">
                    <header className="flex items-center gap-4 border-b border-input-border bg-j-blue-900 px-5 py-5 sm:px-7 sm:py-6">
                        <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-j-yellow-400 text-[#061e50] shadow-sm">
                            <CircleDollarSign size={24} aria-hidden="true" />
                        </span>
                        <div className="min-w-0">
                            <h2 className="text-lg font-extrabold leading-tight text-white sm:text-xl">Pagamentos e cobranças da minha conta</h2>
                            <p className="mt-1 text-sm leading-relaxed text-white/75">
                                Aqui aparecem somente os lançamentos vinculados ao seu cadastro.
                            </p>
                        </div>
                    </header>

                    <div className="space-y-5 p-4 sm:p-6">
                        <FinanceiroFilters initialStatus={status} initialSort={sort} />

                        {loadError ? (
                            <div className="flex min-h-56 flex-col items-center justify-center rounded-2xl border border-dashed border-input-border bg-background-secondary p-6 text-center">
                                <CircleAlert size={30} className="text-j-red-400" aria-hidden="true" />
                                <p className="mt-3 text-sm font-bold text-primary">Não foi possível carregar os débitos</p>
                                <p className="mt-1 max-w-sm text-xs leading-relaxed text-tertiary">
                                    Tente acessar novamente em alguns instantes.
                                </p>
                            </div>
                        ) : charges.length === 0 ? (
                            <div className="flex min-h-56 flex-col items-center justify-center rounded-2xl border border-dashed border-input-border bg-background-secondary p-6 text-center">
                                <ReceiptText size={30} className="text-tertiary" aria-hidden="true" />
                                <p className="mt-3 text-sm font-bold text-primary">Nenhum lançamento encontrado</p>
                                <p className="mt-1 max-w-sm text-xs leading-relaxed text-tertiary">
                                    Você ainda não possui cobranças em sua conta.
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-3.5">
                                {charges.map((charge) => (
                                    <article key={charge.id} data-paid={charge.effectiveStatus === "PAID" ? "" : undefined} className="financeiro-charge-card grid grid-cols-1 gap-4 rounded-2xl border border-input-border bg-background p-4 shadow-sm transition-[background-color,border-color,box-shadow] hover:border-j-blue-200 hover:shadow-md sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-x-6 sm:p-5">
                                        <div className="flex min-w-0 items-center gap-3">
                                            <span className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${STATUS_STYLE[charge.effectiveStatus]}`}>
                                                <ReceiptText size={19} aria-hidden="true" />
                                            </span>
                                            <div className="min-w-0">
                                                <p className="text-sm font-extrabold text-primary">Cobrança #{charge.id}</p>
                                                <p className="mt-0.5 text-xs text-tertiary">Ciclo #{charge.chargeCycleId}</p>
                                            </div>
                                            <span className={`ml-auto shrink-0 rounded-full px-3 py-1 text-xs font-bold sm:hidden ${STATUS_STYLE[charge.effectiveStatus]}`}>
                                                {STATUS_LABEL[charge.effectiveStatus]}
                                            </span>
                                        </div>
                                        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl bg-background-secondary px-3.5 py-3 sm:flex sm:justify-end sm:gap-5 sm:bg-transparent sm:p-0">
                                            <div className="flex min-w-0 items-center gap-2 text-xs text-secondary">
                                                <CalendarDays size={17} className="shrink-0 text-j-blue-700" aria-hidden="true" />
                                                <span className="min-w-0"><span className="block">Vencimento</span><strong className="block text-primary">{formatDate(charge.dueDate)}</strong></span>
                                            </div>
                                            <p className="whitespace-nowrap text-right text-sm font-extrabold text-primary sm:min-w-24">{formatCurrency(charge.finalAmount)}</p>
                                            <span className={`hidden shrink-0 rounded-full px-3 py-1.5 text-xs font-bold sm:inline-flex ${STATUS_STYLE[charge.effectiveStatus]}`}>
                                                {STATUS_LABEL[charge.effectiveStatus]}
                                            </span>
                                        </div>
                                        {charge.effectiveStatus === "PAID" ? (
                                            <p className="flex items-center justify-end gap-2 text-sm font-semibold text-green-800 sm:col-span-2 [:root[data-theme=dark]_&]:text-green-200">
                                                <CheckCircle2 size={17} aria-hidden="true" /> Pagamento concluído
                                            </p>
                                        ) : <PaymentReceiptSubmission charge={charge} submitAction={submitMemberPaymentAction} />}
                                    </article>
                                ))}
                            </div>
                        )}
                        {!loadError && totalPages > 1 && (
                            <nav aria-label="Paginação da gestão de débitos" className="mt-5 flex items-center justify-between border-t border-input-border pt-4">
                                <Link
                                    aria-disabled={pageNumber === 0}
                                    tabIndex={pageNumber === 0 ? -1 : undefined}
                                    href={pageNumber === 0 ? "#" : `?${new URLSearchParams({ ...(status ? { status } : {}), sort, page: String(pageNumber - 1) })}`}
                                    className={`rounded-lg border border-input-border px-4 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-j-blue-800 ${pageNumber === 0 ? "pointer-events-none opacity-40" : "cursor-pointer hover:bg-background-secondary"}`}
                                >Anterior</Link>
                                <span className="text-sm text-secondary">Página {pageNumber + 1} de {totalPages}</span>
                                <Link
                                    aria-disabled={pageNumber + 1 >= totalPages}
                                    tabIndex={pageNumber + 1 >= totalPages ? -1 : undefined}
                                    href={pageNumber + 1 >= totalPages ? "#" : `?${new URLSearchParams({ ...(status ? { status } : {}), sort, page: String(pageNumber + 1) })}`}
                                    className={`rounded-lg border border-input-border px-4 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-j-blue-800 ${pageNumber + 1 >= totalPages ? "pointer-events-none opacity-40" : "cursor-pointer hover:bg-background-secondary"}`}
                                >Próxima</Link>
                            </nav>
                        )}
                    </div>
                </section>
            </div>
        </div>
    );
}
