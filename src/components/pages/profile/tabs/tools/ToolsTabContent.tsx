'use client';

import { Button } from "@/components/common/button";
import { ListPagination } from "@/components/common/table/ListPagination";
import { useModal } from "@/providers/ModalProvider";
import { listToolsAction } from "@/server/actions/tools/list";
import { getMediaImageUrl } from '@/utils/media/imageUrl';
import { useQuery } from "@tanstack/react-query";
import { Eye,Pencil,Plus,Power,Trash2,Wrench } from "lucide-react";
import { useState } from "react";
import { DeleteToolModal } from "./DeleteToolModal";
import { IncludeToolModal } from "./IncludeToolModal";
import { ViewToolModal } from "./ViewToolModal";
import { ToggleToolStatusModal } from "./ToggleToolStatusModal";
import { ProfileEmptyPanel, ProfileStatusSelect, ProfileTabHeader } from "../ProfileTabEmptyState";
import { ProfileStatusBadge } from "../ProfileStatusBadge";
import { ProfileTabLoading } from "../ProfileTabLoading";

const STATUS_LABEL: Record<ToolStatus, string> = {
    ACTIVE: "Ativa",
    INACTIVE: "Inativa",
    ARCHIVED: "Arquivada",
};

const STATUS_FILTER_LABEL: Record<ToolStatus, string> = {
    ACTIVE: "Ferramentas ativas",
    INACTIVE: "Ferramentas inativas",
    ARCHIVED: "Ferramentas arquivadas",
};


export function ToolsTabContent() {
    const { setContent, setOpen } = useModal();
    const [page, setPage] = useState(0);
    const [pageSize, setPageSize] = useState(10);
    const [status, setStatus] = useState<ToolStatus>("ACTIVE");

    const { data, isLoading, isError, isFetching } = useQuery({
        queryKey: ["tools", "list", page, pageSize, status],
        queryFn: () => listToolsAction({ page, size: pageSize, status }),
    });

    const handleOpenInclude = () => {
        setContent(<IncludeToolModal />);
        setOpen();
    };

    const handleOpenEdit = (toolId: number) => {
        setContent(<IncludeToolModal toolId={toolId} />);
        setOpen();
    };

    const handleOpenView = (toolId: number) => {
        setContent(<ViewToolModal toolId={toolId} />);
        setOpen();
    };

    const handleOpenDelete = (tool: ToolListItem) => {
        setContent(<DeleteToolModal toolId={tool.id} toolLabel={tool.name} />);
        setOpen();
    };

    const handleOpenStatus = (tool: ToolListItem) => {
        setContent(<ToggleToolStatusModal toolId={tool.id} toolName={tool.name} nextStatus={tool.status === "ACTIVE" ? "DEACTIVATE" : "ACTIVATE"} />);
        setOpen();
    };

    const statusFilter = <ProfileStatusSelect aria-label="Situação das ferramentas" value={status} onChange={event => { setStatus(event.target.value as ToolStatus); setPage(0); }}>
        {Object.entries(STATUS_FILTER_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
    </ProfileStatusSelect>;

    return (
        <div className="flex flex-col gap-4">
            <ProfileTabHeader
                filter={statusFilter}
                icon={Wrench}
                title="Minhas ferramentas"
                description="Gerencie as ferramentas cadastradas no seu perfil."
                action={<Button type="button" onClick={handleOpenInclude} className="h-11 w-full shrink-0 justify-center whitespace-nowrap rounded-xl px-5"><Plus size={16} aria-hidden="true" />Incluir Ferramenta</Button>}
            />

            {isLoading && <ProfileTabLoading tab="tools" />}

            {isError && (
                <p className="text-sm text-j-red-400">Não foi possível carregar suas ferramentas.</p>
            )}

            {!isLoading && !isError && data?.content.length === 0 && (
                page > 0
                    ? <Button type="button" onClick={() => setPage(0)}>Voltar à primeira página</Button>
                    : <ProfileEmptyPanel icon={Wrench} title={`Nenhuma ferramenta ${STATUS_LABEL[status].toLowerCase()}`} />
            )}

            {!isLoading && !isError && data && data.content.length > 0 && (
                <>
                    <div className="overflow-hidden rounded-2xl border border-j-gray-200 bg-j-white shadow-sm">
                        <div className="hidden grid-cols-[minmax(0,1fr)_minmax(90px,0.65fr)_360px] gap-3 border-b border-j-gray-200 bg-j-gray-100/70 px-4 py-3 text-[10px] font-extrabold uppercase tracking-wide text-j-gray-400 xl:grid">
                            <span>Ferramenta</span>
                            <span className="text-center">Status</span>
                            <span className="text-center">Ações</span>
                        </div>
                        <div className="divide-y divide-j-gray-100">
                            {data.content.map((tool) => (
                                <div key={tool.id} className="flex flex-col gap-3 p-4 transition-colors hover:bg-blue-50/30 [:root[data-theme=dark]_&]:hover:bg-background-secondary xl:grid xl:grid-cols-[minmax(0,1fr)_minmax(90px,0.65fr)_360px] xl:items-center">
                                    <div className="flex min-w-0 items-center gap-3">
                                        {tool.photoStorageKey ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img src={getMediaImageUrl(tool.photoStorageKey)} alt={`Foto de ${tool.name}`} className="size-12 shrink-0 rounded-xl border border-j-gray-200 object-cover" />
                                        ) : <span className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-j-gray-200 bg-j-blue-800 text-j-yellow-300"><Wrench size={19} aria-hidden="true" /></span>}
                                        <div className="min-w-0">
                                            <h4 className="truncate font-extrabold text-j-blue-800" title={tool.name}>{tool.name}</h4>
                                            <ProfileStatusBadge status={tool.status} label={STATUS_LABEL[tool.status]} className="mt-1 inline-flex xl:hidden" />
                                        </div>
                                    </div>
                                    <ProfileStatusBadge status={tool.status} label={STATUS_LABEL[tool.status]} className="hidden justify-self-center xl:inline-flex" />
                                    <div className="grid grid-cols-2 gap-1 xl:grid-cols-4">
                                        <button type="button" aria-label={`Visualizar ${tool.name}`} title="Visualizar" onClick={() => handleOpenView(tool.id)} className="flex min-h-9 cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-blue-50 px-2 py-2 text-xs font-bold text-j-blue-700 transition-colors hover:bg-blue-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current record-action"><Eye size={15} className="shrink-0" aria-hidden="true" /><span>Visualizar</span></button>
                                        <button type="button" aria-label={`Editar ${tool.name}`} title="Editar" onClick={() => handleOpenEdit(tool.id)} className="flex min-h-9 cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-yellow-50 px-2 py-2 text-xs font-bold text-j-gray-700 transition-colors hover:bg-yellow-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current record-action"><Pencil size={15} className="shrink-0 text-j-yellow-500 record-action-icon" aria-hidden="true" /><span>Editar</span></button>
                                        {tool.status !== "ARCHIVED" && <button type="button" onClick={() => handleOpenStatus(tool)} aria-label={`${tool.status === "ACTIVE" ? "Inativar" : "Ativar"} ${tool.name}`} className="record-action flex min-h-9 cursor-pointer items-center justify-center gap-1 rounded-lg bg-blue-50 px-1 py-2 text-xs font-bold text-j-blue-800 hover:bg-blue-100 focus-visible:outline-2 focus-visible:outline-offset-2"><Power size={15} className="shrink-0" aria-hidden="true" /><span>{tool.status === "ACTIVE" ? "Inativar" : "Ativar"}</span></button>}
                                        <button type="button" aria-label={`Excluir ${tool.name}`} title="Excluir" onClick={() => handleOpenDelete(tool)} className="flex min-h-9 cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-red-50 px-2 py-2 text-xs font-bold text-red-500 transition-colors hover:bg-red-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current record-action-danger"><Trash2 size={15} className="shrink-0" aria-hidden="true" /><span>Excluir</span></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                    <ListPagination
                        itemLabel="ferramenta"
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

export default ToolsTabContent;
