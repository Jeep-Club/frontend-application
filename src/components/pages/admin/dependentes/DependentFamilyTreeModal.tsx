"use client";

import { useEffect, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/common/button";
import { useModal } from "@/providers/ModalProvider";
import { useUserStore } from "@/stores/userStore";
import { hasPermission } from "@/utils/permission/hasPermission";
import { getAdminUserAction } from "@/server/actions/admin/users/detail";
import { listDependentsByUserAdminAction } from "@/server/actions/admin/dependents/list";
import { DependentDetailModal } from "./DependentDetailModal";
import { DependentFamilyTreeView } from "./DependentFamilyTreeView";

export function DependentFamilyTreeModal({ dependent, returnFocus }: { dependent: AdminDependentItem; returnFocus?: HTMLElement }) {
    const { setContent, setClose, setOpen } = useModal();
    const permissions = useUserStore((state) => state.permissions);
    const closeButton = useRef<HTMLButtonElement>(null);
    const navigatingToRecord = useRef(false);
    const canReadOwnerProfile = hasPermission(permissions, "IDENTITY", "USER_READ");
    const owner = useQuery({
        queryKey: ["admin", "users", "detail", dependent.userId, permissions],
        queryFn: () => getAdminUserAction(dependent.userId),
        enabled: canReadOwnerProfile && Number.isSafeInteger(dependent.userId) && dependent.userId > 0,
        retry: false,
    });
    const query = useQuery({
        queryKey: ["admin", "dependents", "family", dependent.userId, permissions],
        queryFn: () => listDependentsByUserAdminAction(dependent.userId),
        enabled: Number.isSafeInteger(dependent.userId) && dependent.userId > 0,
        retry: false,
    });

    useEffect(() => {
        closeButton.current?.focus();
        return () => {
            if (!navigatingToRecord.current && returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
        };
    }, [returnFocus]);

    const relatives = useMemo(() => {
        const known = query.data ?? [];
        return known.some((item) => item.id === dependent.id)
            ? known
            : [dependent, ...known];
    }, [dependent, query.data]);
    const ownerName = owner.data?.name ?? relatives.find((item) => item.ownerName?.trim())?.ownerName ?? dependent.ownerName;

    const openDependentRecord = (item: AdminDependentItem) => {
        navigatingToRecord.current = true;
        setContent(<DependentDetailModal dependentId={item.id} userId={item.userId} initialOwnerName={item.ownerName} returnFocus={returnFocus} />);
        setOpen();
    };

    return <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="dependent-family-tree-title"
        aria-busy={query.isLoading}
        onKeyDown={(event) => {
            if (event.key !== "Tab") return;
            const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(
                'button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])',
            )).filter((element) => element.getClientRects().length > 0);
            const first = controls[0];
            const last = controls.at(-1);
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last?.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first?.focus();
            }
        }}
        className="relative flex max-h-[min(90dvh,56rem)] w-full max-w-4xl flex-col overflow-hidden rounded-3xl bg-j-white shadow-2xl"
    >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-j-gray-200 px-4 py-4 pr-2 sm:px-6 sm:py-5 sm:pr-3">
            <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-wide text-j-blue-700">Família do dependente</p>
                <h2 id="dependent-family-tree-title" className="mt-1 break-words text-xl font-extrabold text-j-blue-800 sm:text-2xl">{dependent.name}</h2>
                <p className="mt-1 text-sm text-j-gray-600">Visualização da família vinculada ao titular associado.</p>
            </div>
            <button ref={closeButton} type="button" aria-label="Fechar árvore familiar" onClick={setClose} className="inline-flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-full bg-j-gray-100 text-xl text-j-gray-600 hover:bg-j-gray-200 hover:text-j-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-j-blue-800">×</button>
        </header>

        <div data-modal-scroll className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6">
            {query.isLoading && <p role="status" className="rounded-xl bg-j-gray-100 p-4 text-sm text-j-gray-600">Carregando familiares...</p>}
            {query.isError && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><p>Não foi possível carregar os familiares deste titular. {query.error instanceof Error ? query.error.message : "Tente novamente."}</p><Button className="mt-3" onClick={() => void query.refetch()} disabled={query.isFetching}>{query.isFetching ? "Carregando..." : "Tentar novamente"}</Button></div>}
            {!query.isLoading && !query.isError && <DependentFamilyTreeView ownerName={ownerName} ownerPhotoUrl={owner.data?.profilePhotoUrl} ownerId={dependent.userId} relatives={relatives} selectedDependentId={dependent.id} onOpenDependent={openDependentRecord} />}
        </div>

        <footer className="shrink-0 border-t border-j-gray-200 bg-j-white px-4 py-3 sm:px-6">
            <Button onClick={setClose} className="w-full sm:ml-auto sm:w-auto">Fechar</Button>
        </footer>
    </section>;
}
