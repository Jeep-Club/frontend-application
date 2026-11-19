"use client";

import { useQuery } from "@tanstack/react-query";
import { ProfileTabLoading } from "@/components/pages/profile/tabs/ProfileTabLoading";
import { ProfileEmptyPanel } from "@/components/pages/profile/tabs/ProfileTabEmptyState";
import { useState } from "react";

import { Car,Eye,Filter,Pencil,Plus,ShieldX,Trash2 } from "lucide-react";

import { Button } from "@/components/common/button";
import { AdminExport } from "@/components/common/admin-export/AdminExport";
import { InputSearch } from "@/components/common/input/input-search";
import { PageHeader } from "@/components/common/page-header";
import { TourHelpButton } from "@/components/common/tour/TourHelpButton";
import { getVehiclesTourSteps } from "@/config/tourSteps";
import { usePageTour } from "@/hooks/useTour";
import { Table } from "@/components/common/table";
import { ListPagination } from "@/components/common/table/ListPagination";
import { VehiclePhotoCarousel } from "@/components/pages/profile/tabs/vehicles/VehiclePhotoCarousel";
import { useModal } from "@/providers/ModalProvider";
import { listVehiclesAdminAction } from "@/server/actions/admin/vehicles/list";
import { exportAdminVehiclesAction } from "@/server/actions/admin/vehicles/export";
import { useUserStore } from "@/stores/userStore";
import { maskPlate } from "@/utils/masks/maskPlate";
import { hasPermission } from "@/utils/permission/hasPermission";
import { CreateVehicleModal } from "./CreateVehicleModal";
import { DeleteVehicleModal } from "./DeleteVehicleModal";
import { EditVehicleModal } from "./EditVehicleModal";
import { VehicleDetailModal } from "./VehicleDetailModal";
import {
    VehicleExportFilters,
    type ExportTargetOption,
    type VehicleExportTowingFilter,
} from "./VehicleExportFilters";

const PAGE_SIZE = 10;

function toggleExportOption(list: ExportTargetOption[], option: ExportTargetOption) {
    const exists = list.some((item) => item.id === option.id);
    return exists ? list.filter((item) => item.id !== option.id) : [...list, option];
}

export default function VehicleManagement() {
    const { setContent, setOpen } = useModal();
    const permissions = useUserStore((state) => state.permissions);

    const canRead = hasPermission(permissions, "VEHICLES", "VEHICLE_READ");
    const canCreate = hasPermission(permissions, "VEHICLES", "VEHICLE_CREATE");
    const canUpdate = hasPermission(permissions, "VEHICLES", "VEHICLE_UPDATE");
    const canDelete = hasPermission(permissions, "VEHICLES", "VEHICLE_DELETE");
    const canExport = hasPermission(permissions, "VEHICLES", "VEHICLE_EXPORT");
    const { restartTour } = usePageTour({
        storageKey: "tour_completed_admin_vehicles",
        steps: getVehiclesTourSteps,
        autoStartOnFirstVisit: false,
        enabled: canRead,
    });

    const [search, setSearch] = useState("");
    const [page, setPage] = useState(0);
    const [pageSize, setPageSize] = useState(PAGE_SIZE);
    const [selectedExportVehicles, setSelectedExportVehicles] = useState<ExportTargetOption[]>([]);
    const [selectedExportOwners, setSelectedExportOwners] = useState<ExportTargetOption[]>([]);
    const [exportTowing, setExportTowing] = useState<VehicleExportTowingFilter>("ALL");
    const [showExportFilters, setShowExportFilters] = useState(false);

    const activeExportFilterCount =
        selectedExportVehicles.length + selectedExportOwners.length + (exportTowing !== "ALL" ? 1 : 0);
    const selectedVehicleIdSet = new Set(selectedExportVehicles.map((item) => item.id));

    const query = useQuery({
        queryKey: ["admin", "vehicles", { page, size: pageSize, q: search }],
        queryFn: () => listVehiclesAdminAction({ page, size: pageSize, q: search }),
        placeholderData: (previous) => previous,
        enabled: canRead,
    });

    const { data, isLoading, isFetching, error } = query;

    const handleOpenCreate = () => {
        setContent(<CreateVehicleModal />);
        setOpen();
    };

    const handleOpenDetail = (id: number) => {
        setContent(<VehicleDetailModal vehicleId={id} />);
        setOpen();
    };

    const handleOpenEdit = (id: number) => {
        setContent(<EditVehicleModal vehicleId={id} />);
        setOpen();
    };

    const handleOpenDelete = (vehicle: VehicleListItem) => {
        const label = vehicle.nickname
            ? `${vehicle.model} (${vehicle.nickname}) - ${maskPlate(vehicle.plate)}`
            : `${vehicle.model} - ${maskPlate(vehicle.plate)}`;

        setContent(
            <DeleteVehicleModal
                vehicleId={vehicle.id}
                vehicleLabel={label}
            />,
        );
        setOpen();
    };

    return (
        <div className="min-h-full w-full p-3 md:p-4">
            <div className="flex w-full flex-col gap-4 pb-6">
                <PageHeader id="tour-vehicles-header" title="Gestão de veículos" breadcrumbs={[
                    { label: "Home", href: "/feed" },
                    { label: "Gestão Administrativa", href: "/admin" },
                    { label: "Veículos" },
                ]} actions={
                    canRead ? (
                        <TourHelpButton
                            id="tour-header-help-btn"
                            onClick={restartTour}
                            label="Como gerenciar veículos?"
                            className="w-full justify-center sm:w-auto"
                        />
                    ) : undefined
                } />
                {!canRead ? (
                    <section className="flex min-h-72 flex-col items-center justify-center rounded-2xl border border-dashed border-j-gray-300 bg-j-white p-6 text-center">
                        <ShieldX size={42} className="mb-3 text-j-gray-400" />
                        <h3 className="text-lg font-black text-j-blue-800">Acesso não permitido</h3>
                        <p className="mt-1 text-sm text-j-gray-600">Seu usuário não possui permissão para visualizar a administração de veículos.</p>
                    </section>
                ) : (
                    <div className="flex w-full flex-col gap-3">
                        <section className="flex flex-col overflow-hidden rounded-2xl border border-j-gray-200 bg-j-white shadow-sm">
                            <Table.Header className="items-stretch">
                                <div className="min-w-0 flex-1">
                                    <InputSearch value={search} onSubmit={(value) => { setSearch(value.trim().slice(0, 150)); setPage(0); }} isLoading={isFetching} label="Buscar veículos" placeholder="Buscar por titular, placa, modelo ou apelido..." maxLength={150} />
                                </div>
                                <div className="grid w-full grid-cols-1 gap-2 sm:flex sm:w-auto sm:flex-wrap">
                                    {canExport && (
                                        <>
                                            <AdminExport
                                                label="Exportar veículos"
                                                formats={["CSV", "PDF"]}
                                                className="w-full sm:w-auto"
                                                onExport={(format) =>
                                                    exportAdminVehiclesAction(format, {
                                                        vehicleIds: selectedExportVehicles.map((item) => item.id),
                                                        ownerIds: selectedExportOwners.map((item) => item.id),
                                                        towing: exportTowing,
                                                    })
                                                }
                                            />
                                            <Button
                                                type="button"
                                                aria-expanded={showExportFilters}
                                                aria-controls="vehicle-export-filters"
                                                onClick={() => setShowExportFilters((shown) => !shown)}
                                                className="h-10 w-full gap-2 border border-j-gray-300 bg-j-white px-3 text-xs text-j-blue-800 hover:bg-j-gray-100 hover:text-j-gray-700 focus-visible:bg-j-gray-100 focus-visible:text-j-gray-700 sm:w-auto sm:text-sm"
                                            >
                                                <Filter size={15} aria-hidden="true" />
                                                Filtros da exportação
                                                {activeExportFilterCount > 0 ? ` (${activeExportFilterCount})` : ""}
                                            </Button>
                                        </>
                                    )}
                                    {canCreate && <Button id="tour-vehicles-create-btn" onClick={handleOpenCreate} className="h-10 w-full gap-2 sm:w-auto"><Plus size={16} /><span className="hidden sm:inline">Cadastrar veículo</span><span className="sm:hidden">Cadastrar</span></Button>}
                                </div>
                            </Table.Header>
                            {canExport && showExportFilters && (
                                <VehicleExportFilters
                                    selectedVehicles={selectedExportVehicles}
                                    selectedOwners={selectedExportOwners}
                                    towing={exportTowing}
                                    onToggleVehicle={(vehicle) => setSelectedExportVehicles((current) => toggleExportOption(current, vehicle))}
                                    onToggleOwner={(owner) => setSelectedExportOwners((current) => toggleExportOption(current, owner))}
                                    onTowingChange={setExportTowing}
                                    onClear={() => {
                                        setSelectedExportVehicles([]);
                                        setSelectedExportOwners([]);
                                        setExportTowing("ALL");
                                    }}
                                />
                            )}
                            <div id="tour-vehicles-list">
                            {isLoading && <ProfileTabLoading tab="vehicles" title="Veículos" />}
                            {error && <div role="alert" className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"><p>{error.message}</p><Button onClick={() => query.refetch()} disabled={isFetching}>Tentar novamente</Button></div>}
                            {!isLoading && !error && !data?.content.length && <ProfileEmptyPanel icon={Car} title={search ? "Nenhum veículo encontrado para esta busca." : "Nenhum veículo cadastrado."} />}
                            {!isLoading && !error && Boolean(data?.content.length) && (
                                <div className="overflow-hidden">
                                    <div className="hidden grid-cols-[minmax(0,1.2fr)_minmax(120px,0.6fr)_minmax(140px,1fr)_280px] items-center gap-3 border-b border-j-gray-200 bg-j-gray-100/70 px-4 py-3 text-[10px] font-extrabold uppercase tracking-wide text-j-gray-400 xl:grid">
                                        <span>Veículo</span><span className="text-center">Placa</span><span className="text-center">Dono</span><span className="text-center">Ações</span>
                                    </div>
                                    <div className="divide-y divide-j-gray-100">
                                        {data?.content.map((vehicle, index) => (
                                            <div key={vehicle.id} className="flex flex-col gap-3 p-4 transition-colors hover:bg-blue-50/30 xl:grid xl:grid-cols-[minmax(0,1.2fr)_minmax(120px,0.6fr)_minmax(140px,1fr)_280px] xl:items-center xl:gap-3">
                                                <div className="flex min-w-0 items-center gap-3">
                                                    {canExport && (
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedVehicleIdSet.has(vehicle.id)}
                                                            disabled={vehicle.status !== "ACTIVE"}
                                                            onChange={() =>
                                                                setSelectedExportVehicles((current) =>
                                                                    toggleExportOption(current, {
                                                                        id: vehicle.id,
                                                                        label: `${vehicle.nickname?.trim() ? `${vehicle.nickname.trim()} — ` : ""}${vehicle.model} (${maskPlate(vehicle.plate)}) · #${vehicle.id}`,
                                                                    }),
                                                                )
                                                            }
                                                            aria-label={`Selecionar ${vehicle.model} (${maskPlate(vehicle.plate)}) para exportação`}
                                                            title={vehicle.status !== "ACTIVE" ? "Apenas veículos ativos podem ser exportados" : "Incluir na seleção da exportação"}
                                                            className="h-4 w-4 shrink-0 cursor-pointer rounded border-j-gray-300 text-j-blue-800 focus-visible:outline-2 focus-visible:outline-j-blue-800 disabled:cursor-not-allowed disabled:opacity-40"
                                                        />
                                                    )}
                                                    <div className="flex h-16 w-28 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-j-gray-200 bg-j-blue-800 text-j-yellow-300 sm:h-20 sm:w-36">
                                                        {vehicle.photo || vehicle.photos?.length ? (
                                                            <VehiclePhotoCarousel vehicleId={vehicle.id} admin cover={vehicle.photo} photos={vehicle.photos} alt={`Foto de ${vehicle.nickname || vehicle.model}`} className="h-full w-full" />
                                                        ) : <Car size={24} aria-hidden="true" />}
                                                    </div>
                                                    <h4 className="min-w-0 break-words font-extrabold text-j-blue-800" title={vehicle.nickname?.trim() ? `${vehicle.nickname.trim()} - ${vehicle.model}` : vehicle.model}>
                                                        {vehicle.nickname?.trim() ? <><span className="text-lg [overflow-wrap:anywhere]">{vehicle.nickname.trim()}</span><span className="ml-1 inline-block text-sm font-medium [overflow-wrap:anywhere]">- {vehicle.model}</span></> : <span className="text-lg [overflow-wrap:anywhere]">{vehicle.model}</span>}
                                                    </h4>
                                                </div>
                                                <p className="text-sm font-bold text-j-gray-600 xl:text-center"><span className="mr-1 text-xs xl:hidden">Placa:</span>{maskPlate(vehicle.plate)}</p>
                                                <p className="truncate text-sm text-j-gray-600 xl:text-center" title={vehicle.ownerName ?? undefined}><span className="mr-1 text-xs font-bold xl:hidden">Dono:</span>{vehicle.ownerName || '—'}</p>
                                                <div id={index === 0 ? "tour-vehicles-actions" : undefined} className="grid grid-cols-3 gap-2">
                                                    <button type="button" onClick={() => handleOpenDetail(vehicle.id)} aria-label={`Visualizar ${vehicle.model}`} className="flex min-h-9 cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-blue-50 px-2 py-2 text-xs font-bold text-j-blue-700 hover:bg-blue-100 record-action"><Eye size={15} aria-hidden="true" /><span className="hidden sm:inline">Visualizar</span></button>
                                                    {canUpdate && <button type="button" onClick={() => handleOpenEdit(vehicle.id)} aria-label={`Editar ${vehicle.model}`} className="flex min-h-9 cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-yellow-50 px-2 py-2 text-xs font-bold text-j-gray-700 hover:bg-yellow-100 record-action"><Pencil size={15} className="text-j-yellow-500 record-action-icon" aria-hidden="true" /><span className="hidden sm:inline">Editar</span></button>}
                                                    {canDelete && <button type="button" onClick={() => handleOpenDelete(vehicle)} aria-label={`Excluir ${vehicle.model}`} className="flex min-h-9 cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-red-50 px-2 py-2 text-xs font-bold text-red-500 hover:bg-red-100 record-action-danger"><Trash2 size={15} aria-hidden="true" /><span className="hidden sm:inline">Excluir</span></button>}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            </div>
                        </section>
                            {data && !error && <ListPagination itemLabel="veículo" isFetching={isFetching} pagination={{
                                pageIndex: data.number, pageSize, pageCount: data.totalPages, rowCount: data.totalElements,
                                onChange: (next) => { setPage(next.pageSize !== pageSize ? 0 : next.pageIndex); setPageSize(next.pageSize); },
                            }} />}
                    </div>
                )}
            </div>
        </div>
    );
}
