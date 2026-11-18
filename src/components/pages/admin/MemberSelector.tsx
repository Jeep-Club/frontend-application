"use client";

import { useEffect, useId, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Check, X } from "lucide-react";
import { listUserOptionsAction } from "@/server/actions/admin/users/options";

export interface MemberOption { id: number; name: string }

export function MemberSelector({ value, onChange, disabled = false }: { value: MemberOption | null; onChange: (member: MemberOption | null) => void; disabled?: boolean }) {
    const id = useId();
    const [opened, setOpened] = useState(false);
    const [search, setSearch] = useState("");
    const [debounced, setDebounced] = useState("");
    const [page, setPage] = useState(0);
    useEffect(() => {
        const timer = setTimeout(() => { setDebounced(search.trim()); setPage(0); }, 300);
        return () => clearTimeout(timer);
    }, [search]);
    const waiting = search.trim() !== debounced;
    const query = useQuery({ queryKey: ["admin", "user-options", debounced, page], queryFn: () => listUserOptionsAction(debounced, page), enabled: !disabled && !value && opened && !waiting, gcTime: 0 });
    return <div className="flex flex-col gap-3">
        <label htmlFor={id} className="text-sm font-bold text-j-gray-700">Associado <span className="text-red-500">*</span></label>
        {value ? <div className="flex items-center justify-between gap-3 rounded-xl border border-j-blue-200 bg-blue-50 px-4 py-3">
            <div className="flex min-w-0 items-center gap-2"><Check size={18} className="shrink-0 text-j-blue-700" aria-hidden="true" /><span className="break-words text-sm font-bold text-j-blue-800">{value.name}</span></div>
            <button type="button" disabled={disabled} onClick={() => { onChange(null); setSearch(""); setOpened(true); }} aria-label="Trocar associado" className="rounded-lg p-2 text-j-blue-800 hover:bg-blue-100"><X size={18} /></button>
        </div> : <div>
            <div className="relative"><Search size={18} aria-hidden="true" className="pointer-events-none absolute left-3 top-3.5 text-j-gray-400" /><input id={id} type="search" autoComplete="off" maxLength={150} disabled={disabled} value={search} onFocus={() => setOpened(true)} onChange={event => setSearch(event.target.value)} placeholder="Pesquise pelo nome do associado" aria-describedby={`${id}-status`} className={`w-full rounded-lg border border-input-border bg-input-bg py-3 pl-10 pr-4 text-sm text-input-text focus:bg-input-bg-focus ${opened ? "rounded-b-none" : ""}`} /></div>
            <div id={`${id}-status`} aria-live="polite" className="text-xs text-secondary empty:hidden">
                {opened && (waiting || query.isFetching ? "Pesquisando associados..." : query.isError ? "Não foi possível carregar os associados." : query.data?.empty ? "Nenhum associado encontrado." : "")}
            </div>
            {query.isError && <button type="button" disabled={disabled} onClick={() => void query.refetch()} className="self-start text-sm font-bold text-j-blue-700 hover:underline">Tentar novamente</button>}
            {opened && !waiting && query.data && <>
                <ul aria-label="Associados encontrados" className="max-h-52 overflow-y-auto rounded-b-lg border border-t-0 border-input-border bg-input-bg empty:hidden">{query.data.content.map(member => <li key={member.id}><button type="button" disabled={disabled} onClick={() => onChange(member)} className="flex w-full items-center justify-between gap-3 border-b border-j-gray-100 px-4 py-3 text-left text-sm hover:bg-input-bg-focus focus-visible:bg-input-bg-focus"><span className="font-semibold text-j-blue-800">{member.name}</span></button></li>)}</ul>
                {query.data.totalPages > 1 && <div className="flex items-center justify-between gap-3 text-xs"><button type="button" disabled={disabled || page === 0 || query.isFetching} onClick={() => setPage(current => current - 1)} className="rounded-lg border px-3 py-2 disabled:opacity-40">Anterior</button><span>Página {page + 1} de {query.data.totalPages}</span><button type="button" disabled={disabled || query.data.last || query.isFetching} onClick={() => setPage(current => current + 1)} className="rounded-lg border px-3 py-2 disabled:opacity-40">Próxima</button></div>}
            </>}
        </div>}
    </div>;
}
