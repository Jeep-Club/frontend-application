"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ListFilter, LoaderCircle } from "lucide-react";

interface FinanceiroFiltersProps {
    initialStatus?: MemberChargeStatus;
    initialSort: string;
}

export function FinanceiroFilters({ initialStatus, initialSort }: FinanceiroFiltersProps) {
    const router = useRouter();
    const pathname = usePathname();
    const [status, setStatus] = useState(initialStatus ?? "");
    const [sort, setSort] = useState(initialSort);
    const [isPending, startTransition] = useTransition();

    function applyFilters(nextStatus: string, nextSort: string) {
        const params = new URLSearchParams();
        if (nextStatus) params.set("status", nextStatus);
        if (nextSort) params.set("sort", nextSort);
        params.set("page", "0");

        startTransition(() => {
            router.replace(`${pathname}?${params.toString()}`, { scroll: false });
        });
    }

    function handleStatusChange(value: string) {
        setStatus(value);
        applyFilters(value, sort);
    }

    function handleSortChange(value: string) {
        setSort(value);
        applyFilters(status, value);
    }

    return (
        <div className="rounded-2xl border border-input-border bg-background-secondary p-4 sm:p-5">
            <div className="mb-4 flex items-center gap-2 text-sm font-extrabold text-primary">
                <ListFilter size={17} className="text-j-blue-800" aria-hidden="true" />
                Refine suas cobranças
            </div>
            <div className="grid w-full min-w-0 max-w-full gap-4 sm:grid-cols-2 sm:items-end">
                <label className="flex w-full min-w-0 max-w-full flex-col gap-2 text-xs font-bold text-secondary">
                    Status da cobrança
                    <select
                        name="status"
                        value={status}
                        onChange={(event) => handleStatusChange(event.target.value)}
                        className="block box-border h-11 w-full min-w-0 max-w-full overflow-hidden text-ellipsis rounded-lg border border-input-border bg-input-bg px-3 py-2.5 text-sm font-normal text-input-text focus:border-input-border-focus focus:outline-none focus-visible:ring-2 focus-visible:ring-input-border-focus/30"
                    >
                        <option value="">Todos os status</option>
                        <option value="PENDING">Em aberto (pendente, em atraso ou expirada)</option>
                        <option value="PAID">Paga</option>
                        <option value="CANCELED">Cancelada</option>
                    </select>
                </label>
                <label className="flex w-full min-w-0 max-w-full flex-col gap-2 text-xs font-bold text-secondary">
                    Ordenar por vencimento
                    <select
                        name="sort"
                        value={sort}
                        onChange={(event) => handleSortChange(event.target.value)}
                        className="block box-border h-11 w-full min-w-0 max-w-full overflow-hidden text-ellipsis rounded-lg border border-input-border bg-input-bg px-3 py-2.5 text-sm font-normal text-input-text focus:border-input-border-focus focus:outline-none focus-visible:ring-2 focus-visible:ring-input-border-focus/30"
                    >
                        <option value="dueDate,desc">Mais recentes primeiro</option>
                        <option value="dueDate,asc">Mais antigas primeiro</option>
                    </select>
                </label>
                <span aria-live="polite" className="flex min-h-5 items-center gap-2 text-xs text-secondary sm:col-span-2">
                    {isPending ? <><LoaderCircle size={15} className="animate-spin" aria-hidden="true" /> Atualizando resultados...</> : ""}
                </span>
            </div>
        </div>
    );
}
