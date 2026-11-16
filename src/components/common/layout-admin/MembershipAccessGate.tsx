"use client";

import { createContext, useContext, useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { WalletCards } from "lucide-react";
import { Button } from "@/components/common/button";
import { getMembershipAccessAction } from "@/server/actions/membership/access";
import { useModal } from "@/providers/ModalProvider";
import { canAccessMembershipPage, PAYMENT_HISTORY_PATH, type MembershipAccess } from "@/utils/membership/access";

interface Props {
    initialAccess: MembershipAccess;
    initialPath: string;
    children: ReactNode;
}

const RestrictedMembershipContext = createContext({ restricted: false, showNotice: () => {} });
export const useRestrictedMembership = () => useContext(RestrictedMembershipContext);

export function useRestrictedNavigation() {
    const { restricted, showNotice } = useRestrictedMembership();
    function blockNavigation(event: MouseEvent<HTMLElement>) {
        if (!restricted) return;
        event.preventDefault();
        event.stopPropagation();
        showNotice();
    }
    return { restricted, blockNavigation };
}

function MembershipDebtNotice({ unavailable, retry }: { unavailable: boolean; retry: () => void }) {
    const dialog = useRef<HTMLDialogElement>(null);

    useEffect(() => {
        const element = dialog.current;
        element?.showModal();
        return () => element?.close();
    }, []);

    return (
        <dialog ref={dialog} aria-labelledby="membership-debt-title" aria-describedby="membership-debt-description" className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-input-border bg-j-white p-5 text-primary shadow-xl backdrop:bg-black/60 sm:p-6">
            <span className="mb-3 grid size-11 place-items-center rounded-xl bg-j-blue-50 text-j-blue-800">
                <WalletCards size={22} aria-hidden="true" />
            </span>
            <h2 id="membership-debt-title" className="text-lg font-extrabold">{unavailable ? "Verificação da cobrança indisponível" : "Acesso bloqueado por falta de pagamento"}</h2>
            <p id="membership-debt-description" className="mt-2 text-sm leading-relaxed text-secondary">
                {unavailable ? "Não conseguimos confirmar a situação da sua cobrança. Verifique novamente." : "Você não pagou uma cobrança obrigatória da associação. Seu acesso ao sistema só será liberado após a confirmação do pagamento."}
            </p>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
                {unavailable && <Button type="button" onClick={() => { dialog.current?.close(); retry(); }}>Verificar novamente</Button>}
                <Button type="button" onClick={() => dialog.current?.close()}>Ver meus débitos</Button>
            </div>
        </dialog>
    );
}

export function MembershipAccessGate({ initialAccess, initialPath, children }: Props) {
    const pathname = usePathname();
    const [noticeRequest, setNoticeRequest] = useState(0);
    const router = useRouter();
    const { setClose } = useModal();
    const previousAccess = useRef(initialAccess);
    const access = useQuery({
        queryKey: ["membership", "access", pathname],
        queryFn: getMembershipAccessAction,
        initialData: pathname === initialPath ? initialAccess : undefined,
        // Recheck on navigation and focus, including when a previously visited route is cached.
        staleTime: 0,
        refetchOnMount: "always",
        refetchOnWindowFocus: true,
        refetchInterval: 60_000,
        retry: false,
    });
    const state = access.data ?? "unavailable";
    const canVisit = canAccessMembershipPage(state, pathname);

    useEffect(() => {
        if (access.data && !access.isFetching && !canVisit) router.replace(PAYMENT_HISTORY_PATH);
    }, [access.data, access.isFetching, canVisit, router]);

    useEffect(() => {
        if (access.data && previousAccess.current === "allowed" && state !== "allowed") setClose();
        if (access.data) previousAccess.current = state;
    }, [access.data, state, setClose]);

    if (!canVisit || (!access.isFetchedAfterMount && !canAccessMembershipPage("payment-required", pathname))) {
        return <main className="flex min-h-dvh items-center justify-center bg-background p-6 text-primary"><p role="status">Verificando acesso…</p></main>;
    }

    return (
        <RestrictedMembershipContext.Provider value={{ restricted: state !== "allowed", showNotice: () => setNoticeRequest((count) => count + 1) }}>
            {children}
            {!access.isPending && state !== "allowed" && (pathname === PAYMENT_HISTORY_PATH || noticeRequest > 0) && (
                <MembershipDebtNotice key={`${state}:${pathname}:${noticeRequest}`} unavailable={state === "unavailable"} retry={() => void access.refetch()} />
            )}
        </RestrictedMembershipContext.Provider>
    );
}
