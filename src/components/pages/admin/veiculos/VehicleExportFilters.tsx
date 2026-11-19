"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Search, X } from "lucide-react";

import { listUserOptionsAction } from "@/server/actions/admin/users/options";
import { listVehiclesAdminAction } from "@/server/actions/admin/vehicles/list";
import { maskPlate } from "@/utils/masks/maskPlate";

const MAX_SELECTED_ITEMS = 200;

export interface ExportTargetOption {
    id: number;
    label: string;
}

export type VehicleExportTowingFilter = "ALL" | "YES" | "NO";

interface PickerPage {
    content: ExportTargetOption[];
    totalPages: number;
    last: boolean;
    empty: boolean;
}

interface ExportTargetPickerProps {
    label: string;
    placeholder: string;
    helperText?: string;
    emptyText: string;
    errorText: string;
    queryPrefix: string;
    selected: ExportTargetOption[];
    onToggle: (option: ExportTargetOption) => void;
    fetchPage: (search: string, page: number) => Promise<PickerPage>;
}

/** Searchable multi-select picker backed by paginated admin queries with removable selection chips. */
function ExportTargetPicker({
    label,
    placeholder,
    helperText,
    emptyText,
    errorText,
    queryPrefix,
    selected,
    onToggle,
    fetchPage,
}: ExportTargetPickerProps) {
    const inputId = useId();
    const containerRef = useRef<HTMLDivElement>(null);
    const [opened, setOpened] = useState(false);
    const [search, setSearch] = useState("");
    const [debounced, setDebounced] = useState("");
    const [page, setPage] = useState(0);
    const [limitMessage, setLimitMessage] = useState("");

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebounced(search.trim());
            setPage(0);
        }, 300);
        return () => clearTimeout(timer);
    }, [search]);

    useEffect(() => {
        if (!opened) return;
        const handleOutside = (event: MouseEvent) => {
            if (!containerRef.current?.contains(event.target as Node)) {
                setOpened(false);
            }
        };
        document.addEventListener("mousedown", handleOutside);
        return () => document.removeEventListener("mousedown", handleOutside);
    }, [opened]);

    const waiting = search.trim() !== debounced;
    const query = useQuery({
        queryKey: ["admin", "vehicle-export-picker", queryPrefix, debounced, page],
        queryFn: () => fetchPage(debounced, page),
        enabled: opened && !waiting,
        gcTime: 0,
    });

    const selectedIds = new Set(selected.map((item) => item.id));
    const handleOptionToggle = (option: ExportTargetOption) => {
        if (!selectedIds.has(option.id) && selected.length >= MAX_SELECTED_ITEMS) {
            setLimitMessage(`Limite de ${MAX_SELECTED_ITEMS} itens por filtro atingido.`);
            return;
        }
        setLimitMessage("");
        onToggle(option);
    };

    return (
        <div
            ref={containerRef}
            className="flex min-w-0 flex-col gap-1.5"
            onKeyDown={(event) => {
                if (event.key === "Escape") setOpened(false);
            }}
        >
            <div className="flex items-center justify-between gap-2">
                <label htmlFor={inputId} className="text-xs font-semibold text-j-gray-600">
                    {label}
                </label>
                {selected.length > 0 && (
                    <span className="text-[11px] font-semibold text-j-blue-800">
                        {selected.length} selecionado(s)
                    </span>
                )}
            </div>

            {selected.length > 0 && (
                <ul aria-label={`${label} selecionados`} className="flex flex-wrap gap-1.5">
                    {selected.map((item) => (
                        <li key={item.id}>
                            <span className="inline-flex max-w-full items-center gap-1 rounded-full border border-j-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-j-blue-800">
                                <span className="truncate">{item.label}</span>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setLimitMessage("");
                                        onToggle(item);
                                    }}
                                    aria-label={`Remover ${item.label}`}
                                    className="shrink-0 cursor-pointer rounded-full p-0.5 text-j-blue-800 hover:bg-blue-100 focus-visible:outline-2 focus-visible:outline-j-blue-800"
                                >
                                    <X size={12} aria-hidden="true" />
                                </button>
                            </span>
                        </li>
                    ))}
                </ul>
            )}

            <div className="relative">
                <Search size={15} aria-hidden="true" className="pointer-events-none absolute left-3 top-3 text-j-gray-400" />
                <input
                    id={inputId}
                    type="search"
                    autoComplete="off"
                    maxLength={150}
                    value={search}
                    onFocus={() => setOpened(true)}
                    onChange={(event) => {
                        setSearch(event.target.value);
                        setOpened(true);
                    }}
                    placeholder={placeholder}
                    aria-describedby={`${inputId}-help ${inputId}-status`}
                    className={`min-h-10 w-full rounded-lg border border-j-gray-300 bg-j-white py-2 pl-9 pr-3 text-sm font-normal text-j-gray-800 focus-visible:outline-2 focus-visible:outline-j-blue-800 ${opened ? "rounded-b-none" : ""}`}
                />
            </div>

            {helperText && (
                <p id={`${inputId}-help`} className="text-[11px] text-j-gray-500">
                    {helperText}
                </p>
            )}

            <div id={`${inputId}-status`} aria-live="polite" className="text-xs text-j-gray-600 empty:hidden">
                {limitMessage ||
                    (opened &&
                        (waiting || query.isFetching
                            ? "Buscando opções..."
                            : query.isError
                              ? errorText
                              : query.data?.empty
                                ? emptyText
                                : ""))}
            </div>

            {query.isError && (
                <button
                    type="button"
                    onClick={() => void query.refetch()}
                    className="self-start cursor-pointer text-xs font-bold text-j-blue-800 underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-j-blue-800"
                >
                    Tentar novamente
                </button>
            )}

            {opened && !waiting && query.data && !query.data.empty && (
                <div className="overflow-hidden rounded-b-lg border border-t-0 border-j-gray-300 bg-j-white shadow-sm">
                    <ul aria-label={`Opções de ${label}`} className="max-h-48 divide-y divide-j-gray-100 overflow-y-auto">
                        {query.data.content.map((option) => {
                            const isSelected = selectedIds.has(option.id);
                            return (
                                <li key={option.id}>
                                    <button
                                        type="button"
                                        aria-pressed={isSelected}
                                        onClick={() => handleOptionToggle(option)}
                                        className={`flex w-full cursor-pointer items-center justify-between gap-2 px-3 py-2 text-left text-xs transition-colors hover:bg-blue-50/50 focus-visible:bg-blue-50/50 focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-j-blue-800 ${
                                            isSelected ? "bg-blue-50/80 font-bold text-j-blue-800" : "text-j-gray-800"
                                        }`}
                                    >
                                        <span className="min-w-0 truncate">{option.label}</span>
                                        {isSelected && <Check size={14} className="shrink-0 text-j-blue-800" aria-hidden="true" />}
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                    <div className="flex items-center justify-between gap-2 border-t border-j-gray-200 bg-j-gray-100/60 px-3 py-1.5 text-[11px] text-j-gray-600">
                        <div className="flex items-center gap-2">
                            {query.data.totalPages > 1 && (
                                <>
                                    <button
                                        type="button"
                                        disabled={page === 0 || query.isFetching}
                                        onClick={() => setPage((current) => current - 1)}
                                        className="cursor-pointer rounded border border-j-gray-300 bg-j-white px-2 py-0.5 font-semibold disabled:cursor-not-allowed disabled:opacity-40"
                                    >
                                        Anterior
                                    </button>
                                    <span>
                                        {page + 1}/{query.data.totalPages}
                                    </span>
                                    <button
                                        type="button"
                                        disabled={query.data.last || query.isFetching}
                                        onClick={() => setPage((current) => current + 1)}
                                        className="cursor-pointer rounded border border-j-gray-300 bg-j-white px-2 py-0.5 font-semibold disabled:cursor-not-allowed disabled:opacity-40"
                                    >
                                        Próxima
                                    </button>
                                </>
                            )}
                        </div>
                        <button
                            type="button"
                            onClick={() => setOpened(false)}
                            className="cursor-pointer font-semibold text-j-blue-800 hover:underline"
                        >
                            Fechar
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

interface VehicleExportFiltersProps {
    selectedVehicles: ExportTargetOption[];
    selectedOwners: ExportTargetOption[];
    towing: VehicleExportTowingFilter;
    onToggleVehicle: (vehicle: ExportTargetOption) => void;
    onToggleOwner: (owner: ExportTargetOption) => void;
    onTowingChange: (towing: VehicleExportTowingFilter) => void;
    onClear: () => void;
}

export function VehicleExportFilters({
    selectedVehicles,
    selectedOwners,
    towing,
    onToggleVehicle,
    onToggleOwner,
    onTowingChange,
    onClear,
}: VehicleExportFiltersProps) {
    const towingSelectId = useId();
    const hasFilters = selectedVehicles.length > 0 || selectedOwners.length > 0 || towing !== "ALL";

    return (
        <fieldset id="vehicle-export-filters" className="grid grid-cols-1 gap-4 border-b border-j-gray-200 bg-j-gray-100/50 p-4 lg:grid-cols-3">
            <legend className="px-1 text-sm font-bold text-j-blue-800">Filtrar o arquivo exportado</legend>

            <ExportTargetPicker
                label="Veículos (seleção múltipla)"
                placeholder="Buscar por placa, modelo, apelido ou titular..."
                helperText="Opcional. Selecione 1 ou mais veículos ativos (ou marque direto na tabela)."
                emptyText="Nenhum veículo ativo encontrado."
                errorText="Não foi possível carregar os veículos."
                queryPrefix="vehicles"
                selected={selectedVehicles}
                onToggle={onToggleVehicle}
                fetchPage={async (search, page) => {
                    const res = await listVehiclesAdminAction({ page, size: 20, q: search || undefined });
                    return {
                        content: res.content.map((v) => ({
                            id: v.id,
                            label: `${v.nickname?.trim() ? `${v.nickname.trim()} — ` : ""}${v.model} (${maskPlate(v.plate)}) · #${v.id}`,
                        })),
                        totalPages: res.totalPages,
                        last: res.last,
                        empty: res.empty,
                    };
                }}
            />

            <ExportTargetPicker
                label="Proprietários (seleção múltipla)"
                placeholder="Buscar associado por nome..."
                helperText="1 proprietário agrupa o PDF pelo titular; múltiplos geram PDF plano."
                emptyText="Nenhum associado encontrado."
                errorText="Não foi possível carregar os associados."
                queryPrefix="owners"
                selected={selectedOwners}
                onToggle={onToggleOwner}
                fetchPage={async (search, page) => {
                    const res = await listUserOptionsAction(search, page);
                    return {
                        content: res.content.map((user) => ({
                            id: user.id,
                            label: `${user.name} (#${user.id})`,
                        })),
                        totalPages: res.totalPages,
                        last: res.last,
                        empty: res.empty,
                    };
                }}
            />

            <div className="flex min-w-0 flex-col gap-1.5">
                <label htmlFor={towingSelectId} className="text-xs font-semibold text-j-gray-600">
                    Guincho/reboque
                </label>
                <select
                    id={towingSelectId}
                    value={towing}
                    onChange={(event) => onTowingChange(event.target.value as VehicleExportTowingFilter)}
                    className="min-h-10 w-full cursor-pointer rounded-lg border border-j-gray-300 bg-j-white px-3 text-sm font-normal text-j-gray-800 focus-visible:outline-2 focus-visible:outline-j-blue-800"
                >
                    <option value="ALL">Todos</option>
                    <option value="YES">Com reboque</option>
                    <option value="NO">Sem reboque</option>
                </select>
                <p className="text-[11px] text-j-gray-500">
                    A exportação considera apenas veículos ativos e combina filtros com AND.
                </p>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 lg:col-span-3">
                <button
                    type="button"
                    disabled={!hasFilters}
                    onClick={onClear}
                    className="min-h-9 cursor-pointer rounded-lg px-3 text-xs font-bold text-j-blue-800 underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-j-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    Limpar filtros da exportação
                </button>
            </div>
        </fieldset>
    );
}
