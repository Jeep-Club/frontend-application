'use client';

import { Button } from "@/components/common/button";
import { RecordStatusAction } from "@/components/common/record-status/RecordStatusAction";
import { VEHICLE_STATUS_LABEL } from "@/components/pages/admin/veiculos/vehicleDisplay";
import { ListPagination } from "@/components/common/table/ListPagination";
import { useModal } from "@/providers/ModalProvider";
import { listVehiclesMemberAction } from "@/server/actions/vehicles/list-member";
import { changeVehicleStatusAction } from "@/server/actions/vehicles/change-status";
import { maskPlate } from "@/utils/masks/maskPlate";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays,Car,Eye,Palette,Pencil,Plus,Trash2 } from "lucide-react";
import { useState } from "react";
import { DeleteVehicleModal } from "./DeleteVehicleModal";
import { IncludeVehicleModal } from "./IncludeVehicleModal";
import { VehiclePhotoCarousel } from "./VehiclePhotoCarousel";
import { ViewVehicleModal } from "./ViewVehicleModal";
import { ProfileTabLoading } from "../ProfileTabLoading";
import { ProfileTabEmptyState, ProfileStatusSelect, ProfileTabHeader } from "../ProfileTabEmptyState";
import { ProfileStatusBadge } from "../ProfileStatusBadge";

export function VehiclesTabContent() {
    const { setContent, setOpen } = useModal();
    const [page, setPage] = useState(0);
    const [pageSize, setPageSize] = useState(10);
    const [showInactive, setShowInactive] = useState(false);

    const { data, isLoading, isError, isFetching } = useQuery({
        queryKey: ["vehicles", "list-member", page, pageSize, showInactive],
        queryFn: () => listVehiclesMemberAction({ page, size: pageSize, status: showInactive ? "INACTIVE" : undefined }),
    });

    const handleOpenIncludeVehicle = () => {
        setContent(<IncludeVehicleModal />);
        setOpen();
    };

    const handleOpenEditVehicle = (vehicleId: number) => {
        setContent(<IncludeVehicleModal vehicleId={vehicleId} />);
        setOpen();
    };

    const handleOpenViewVehicle = (vehicleId: number) => {
        setContent(<ViewVehicleModal vehicleId={vehicleId} />);
        setOpen();
    };

    const handleOpenDeleteVehicle = (vehicle: VehicleListItem) => {
        setContent(
            <DeleteVehicleModal
                vehicleId={vehicle.id}
                vehicleLabel={vehicle.nickname || `${vehicle.model} (${maskPlate(vehicle.plate)})`}
            />
        );
        setOpen();
    };

    const statusFilter = <ProfileStatusSelect aria-label="Situação dos veículos" value={showInactive ? "INACTIVE" : "ACTIVE"} onChange={event => { setShowInactive(event.target.value === "INACTIVE"); setPage(0); }}>
        <option value="ACTIVE">Veículos ativos</option>
        <option value="INACTIVE">Veículos inativos</option>
    </ProfileStatusSelect>;

    if (!isLoading && !isError && data?.content.length === 0 && page === 0) {
        return <ProfileTabEmptyState
            filter={statusFilter}
            icon={Car}
            title="Meus veículos"
            description="Gerencie os veículos cadastrados no seu perfil."
            emptyTitle={showInactive ? "Nenhum veículo inativo" : "Nenhum veículo ativo"}
            emptyDescription={showInactive ? "Veículos inativados aparecem aqui." : "Inclua seu veículo e mantenha os dados mais organizados no seu perfil."}
            action={<Button onClick={handleOpenIncludeVehicle} className="h-11 w-full shrink-0 justify-center whitespace-nowrap rounded-xl px-5"><Plus size={16} /><span>Incluir Veículo</span></Button>}
        />;
    }

    return (
        <div className="flex flex-col gap-4">
            <ProfileTabHeader
                filter={statusFilter}
                icon={Car}
                title="Meus veículos"
                description="Gerencie os veículos cadastrados no seu perfil."
                action={<Button type="button" onClick={handleOpenIncludeVehicle} className="h-11 w-full shrink-0 justify-center whitespace-nowrap rounded-xl px-5"><Plus size={16} aria-hidden="true" />Incluir Veículo</Button>}
            />


            {isLoading && (
                <ProfileTabLoading tab="vehicles" />
            )}

            {isError && (
                <p className="text-sm text-j-red-400">Não foi possível carregar seus veículos.</p>
            )}

            {!isLoading && !isError && data?.content.length === 0 && page > 0 && (
                <Button type="button" onClick={() => setPage(0)}>Voltar à primeira página</Button>
            )}

            {!isLoading && !isError && data && data.content.length > 0 && (
                <>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                        {data.content.map((vehicle) => (
                            <div
                                key={vehicle.id}
                                className="group @container/vehicle flex min-w-0 flex-col overflow-hidden rounded-2xl border border-j-gray-200 bg-j-white shadow-sm transition-shadow hover:shadow-md"
                            >
                                <div className="relative aspect-video w-full overflow-hidden bg-[#111827]">
                                    <VehiclePhotoCarousel vehicleId={vehicle.id} cover={vehicle.photo} photos={vehicle.photos} alt={`Foto de ${vehicle.nickname || vehicle.model}`} className="absolute inset-0 h-full w-full" />
                                </div>

                                <div className="flex flex-1 flex-col gap-4 p-4 sm:p-5">
                                    <div className="min-w-0">
                                        <h4 className="mt-0.5 text-xl font-black leading-tight text-j-blue-800 [overflow-wrap:anywhere]">
                                            {vehicle.nickname?.trim()
                                                ? <>{vehicle.nickname.trim()}<span className="mt-1 block text-sm font-medium">{vehicle.model}</span></>
                                                : vehicle.model}
                                        </h4>
                                        <ProfileStatusBadge status={vehicle.status} label={VEHICLE_STATUS_LABEL[vehicle.status]} className="mt-1.5 inline-flex" />
                                    </div>

                                    <div className="flex w-44 max-w-full flex-col overflow-hidden rounded-lg border border-j-gray-300 bg-white text-center shadow-sm self-center">
                                        <span className="bg-j-blue-800 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.18em] text-white">
                                            Placa do veículo
                                        </span>
                                        <span className="px-2 py-1.5 font-mono text-lg font-extrabold leading-none tracking-[0.14em] text-slate-950" aria-label={`Placa ${maskPlate(vehicle.plate)}`}>
                                            {maskPlate(vehicle.plate)}
                                        </span>
                                    </div>

                                    <dl className="grid grid-cols-2 divide-x divide-input-border/50 rounded-xl bg-background-secondary py-2.5">
                                        <div className="min-w-0 px-3">
                                            <dt className="flex items-center gap-1.5 text-xs font-medium text-secondary">
                                                <CalendarDays size={14} className="shrink-0 text-(--accent-text)" aria-hidden="true" />
                                                Ano
                                            </dt>
                                            <dd className="mt-1 pl-5 text-sm font-bold text-primary">{vehicle.modelYear}</dd>
                                        </div>
                                        <div className="min-w-0 px-3">
                                            <dt className="flex items-center gap-1.5 text-xs font-medium text-secondary">
                                                <Palette size={14} className="shrink-0 text-(--accent-text)" aria-hidden="true" />
                                                Cor
                                            </dt>
                                            <dd className="mt-1 pl-5 text-sm font-bold text-primary [overflow-wrap:anywhere]">{vehicle.color}</dd>
                                        </div>
                                    </dl>

                                    <div className="mt-auto grid grid-cols-2 gap-2 border-t border-j-gray-100 pt-3 sm:@min-[24rem]/vehicle:grid-cols-4 [&>button>svg]:shrink-0 [&>button>span]:inline">
                                        <button
                                            type="button"
                                            aria-label="Visualizar veículo"
                                            onClick={() => handleOpenViewVehicle(vehicle.id)}
                                            className="flex min-h-9 cursor-pointer items-center justify-center gap-1 rounded-lg bg-blue-50 px-1 py-2 text-xs font-bold text-j-blue-700 transition-colors hover:bg-blue-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current record-action"
                                        >
                                            <Eye size={15} aria-hidden="true" /><span>Visualizar</span>
                                        </button>
                                        <button
                                            type="button"
                                            aria-label="Editar veículo"
                                            onClick={() => handleOpenEditVehicle(vehicle.id)}
                                            className="flex min-h-9 cursor-pointer items-center justify-center gap-1 rounded-lg bg-yellow-50 px-1 py-2 text-xs font-bold text-j-gray-700 transition-colors hover:bg-yellow-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current record-action"
                                        >
                                            <Pencil size={15} className="text-j-yellow-500 record-action-icon" aria-hidden="true" /><span>Editar</span>
                                        </button>
                                        {vehicle.status !== "ARCHIVED" && <RecordStatusAction name={vehicle.nickname || vehicle.model} active={vehicle.status === "ACTIVE"} onConfirm={() => changeVehicleStatusAction(vehicle.id, vehicle.status === "ACTIVE" ? "deactivate" : "activate", "member")} queryKeys={[["vehicles"], ["admin", "vehicles"]]} />}
                                        <button
                                            type="button"
                                            aria-label="Excluir veículo"
                                            onClick={() => handleOpenDeleteVehicle(vehicle)}
                                            className="flex min-h-9 cursor-pointer items-center justify-center gap-1 rounded-lg bg-red-50 px-1 py-2 text-xs font-bold text-red-500 transition-colors hover:bg-red-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current record-action-danger"
                                        >
                                            <Trash2 size={15} aria-hidden="true" /><span>Excluir</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <ListPagination
                        itemLabel="veículo"
                        isFetching={isFetching}
                        pagination={{
                            pageIndex: data.number,
                            pageSize,
                            pageCount: data.totalPages,
                            rowCount: data.totalElements,
                            onChange: (next) => {
                                setPage(next.pageSize !== pageSize ? 0 : next.pageIndex);
                                setPageSize(next.pageSize);
                            },
                        }}
                    />
                </>
            )}
        </div>
    );
}

export default VehiclesTabContent;
