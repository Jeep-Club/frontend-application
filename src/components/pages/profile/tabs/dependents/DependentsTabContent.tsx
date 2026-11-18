'use client';

import { Button } from '@/components/common/button';
import { RecordStatusAction } from '@/components/common/record-status/RecordStatusAction';
import { ListPagination } from '@/components/common/table/ListPagination';
import { useModal } from '@/providers/ModalProvider';
import { changeDependentStatusAction, listDependentsAction, listInactiveDependentsAction } from '@/server/actions/dependents';
import { useQuery } from '@tanstack/react-query';
import { Eye,Pencil,Plus,RefreshCw,Trash2,Users } from 'lucide-react';
import { useState } from 'react';
import { CreateDependentModal } from './CreateDependentModal';
import { DeleteDependentModal } from './DeleteDependentModal';
import { DependentPhoto } from './DependentPhoto';
import { ViewDependentModal } from './ViewDependentModal';
import { ProfileTabLoading } from '../ProfileTabLoading';
import { ProfileTabEmptyState, ProfileStatusSelect, ProfileTabHeader } from '../ProfileTabEmptyState';
import { ProfileStatusBadge } from "../ProfileStatusBadge";

const RELATIONSHIP_LABELS:Record<MemberDependentRelationshipType,string>={
    CHILD:'Filho(a)',GUEST:'Convidado(a)',OTHER:'Outro',PARENT:'Pai/Mãe',SIBLING:'Irmão/Irmã',SPOUSE:'Cônjuge',
};

const STATUS_LABEL = { ACTIVE: 'Ativo', INACTIVE: 'Inativo', ARCHIVED: 'Arquivado' };

export function DependentsTabContent(){
    const {setContent,setOpen}=useModal();
    const [pagination,setPagination]=useState({pageIndex:0,pageSize:10});
    const [showInactive, setShowInactive] = useState(false);
    const {data=[],isLoading,isError,isFetching,refetch}=useQuery({queryKey: showInactive ? ['dependents', 'inactive'] : ['dependents'], queryFn: showInactive ? listInactiveDependentsAction : listDependentsAction});
    const pageCount=Math.ceil(data.length/pagination.pageSize);
    const pageIndex=Math.min(pagination.pageIndex,Math.max(0,pageCount-1));
    const visibleDependents=data.slice(pageIndex*pagination.pageSize,(pageIndex+1)*pagination.pageSize);
    const open=(content:React.ReactNode)=>{setContent(content);setOpen()};

    const statusFilter = <ProfileStatusSelect aria-label="Situação dos dependentes" value={showInactive ? 'INACTIVE' : 'ACTIVE'} onChange={event => { setShowInactive(event.target.value === 'INACTIVE'); setPagination(previous => ({ ...previous, pageIndex: 0 })); }}>
        <option value="ACTIVE">Dependentes ativos</option>
        <option value="INACTIVE">Dependentes inativos</option>
    </ProfileStatusSelect>;

    if(!isLoading&&!isError&&!data.length){
        return <ProfileTabEmptyState
            filter={statusFilter}
            icon={Users}
            title="Meus dependentes"
            description="Gerencie as pessoas vinculadas ao seu perfil."
            emptyTitle={showInactive ? "Nenhum dependente inativo" : "Nenhum dependente ativo"}
            emptyDescription={showInactive ? "Dependentes inativados aparecem aqui." : "Inclua seus dependentes e mantenha vínculos disponíveis no seu perfil."}
            action={<Button onClick={()=>open(<CreateDependentModal/>)} className="h-11 w-full shrink-0 justify-center whitespace-nowrap rounded-xl px-5"><Plus size={16}/><span>Incluir dependente</span></Button>}
        />;
    }

    return <div className="flex flex-col gap-4">
        <ProfileTabHeader
            filter={statusFilter}
            icon={Users}
            title="Meus dependentes"
            description="Gerencie as pessoas vinculadas ao seu perfil."
            action={<Button type="button" onClick={()=>open(<CreateDependentModal/>)} className="h-11 w-full shrink-0 justify-center whitespace-nowrap rounded-xl px-5"><Plus size={16} aria-hidden="true" />Incluir dependente</Button>}
        />
        {isLoading&&<ProfileTabLoading tab="dependents" />}
        {isError&&<div className="flex flex-col items-start gap-3"><p className="text-sm text-j-red-400">Não foi possível carregar seus dependentes.</p><Button onClick={()=>refetch()} disabled={isFetching}><RefreshCw size={16} className={isFetching?'animate-spin':''}/>Tentar novamente</Button></div>}
        {!isLoading&&!isError&&data.length>0&&<div className="overflow-hidden rounded-2xl border border-j-gray-200 bg-j-white shadow-sm">
            <div className="hidden grid-cols-[minmax(0,1.4fr)_minmax(110px,0.7fr)_minmax(100px,0.5fr)_360px] gap-3 border-b border-j-gray-200 bg-j-gray-100/70 px-4 py-3 text-[10px] font-extrabold uppercase tracking-wide text-j-gray-400 xl:grid">
                <span>Dependente</span><span className="text-center">Parentesco</span><span className="text-center">Status</span><span className="text-center">Ações</span>
            </div>
            <div className="divide-y divide-j-gray-100">{visibleDependents.map(dependent=><div key={dependent.id} className="flex flex-col gap-3 p-4 transition-colors hover:bg-blue-50/30 [:root[data-theme=dark]_&]:hover:bg-background-secondary xl:grid xl:grid-cols-[minmax(0,1.4fr)_minmax(110px,0.7fr)_minmax(100px,0.5fr)_360px] xl:items-center xl:gap-3">
                <div className="flex min-w-0 items-center gap-3"><DependentPhoto dependent={dependent} /><div className="min-w-0"><p className="truncate font-extrabold text-j-blue-800">{dependent.name}</p><p className="text-xs text-j-gray-400 xl:hidden">{RELATIONSHIP_LABELS[dependent.relationshipType]}</p><ProfileStatusBadge status={dependent.status} label={STATUS_LABEL[dependent.status]} className="mt-1 inline-flex xl:hidden" /></div></div>
                <span className="hidden w-fit justify-self-center rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-j-blue-700 [:root[data-theme=dark]_&]:bg-blue-950 [:root[data-theme=dark]_&]:text-blue-200 xl:inline-flex">{RELATIONSHIP_LABELS[dependent.relationshipType]}</span>
                <ProfileStatusBadge status={dependent.status} label={STATUS_LABEL[dependent.status]} className="hidden justify-self-center xl:inline-flex" />
                <div className="grid grid-cols-2 gap-1 xl:grid-cols-4 [&>button>svg]:shrink-0 [&>button>span]:inline">
                    <button type="button" onClick={()=>open(<ViewDependentModal dependent={dependent}/>)} className="flex min-h-9 cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-blue-50 px-2 py-2 text-xs font-bold text-j-blue-700 transition-colors hover:bg-blue-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current record-action" aria-label="Visualizar"><Eye size={15} aria-hidden="true" /><span>Visualizar</span></button>
                    <button type="button" onClick={()=>open(<CreateDependentModal dependent={dependent}/>)} className="flex min-h-9 cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-yellow-50 px-2 py-2 text-xs font-bold text-j-gray-700 transition-colors hover:bg-yellow-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current record-action" aria-label="Editar"><Pencil size={15} className="text-j-yellow-500 record-action-icon" aria-hidden="true" /><span>Editar</span></button>
                    {dependent.status !== 'ARCHIVED' && <RecordStatusAction name={dependent.name} active={dependent.status === 'ACTIVE'} onConfirm={() => changeDependentStatusAction(dependent.id, dependent.status === 'ACTIVE' ? 'disable' : 'enable')} queryKeys={[["dependents"], ["admin", "dependents"]]} />}
                    <button type="button" onClick={()=>open(<DeleteDependentModal dependent={dependent}/>)} className="flex min-h-9 cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-red-50 px-2 py-2 text-xs font-bold text-red-500 transition-colors hover:bg-red-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current record-action-danger" aria-label="Excluir"><Trash2 size={15} aria-hidden="true" /><span>Excluir</span></button>
                </div>
            </div>)}</div>
        </div>}
        {!isLoading&&!isError&&data.length>0&&<ListPagination itemLabel="dependente" isFetching={isFetching} pagination={{pageIndex,pageSize:pagination.pageSize,pageCount,rowCount:data.length,onChange:(next)=>setPagination({pageIndex:next.pageSize!==pagination.pageSize?0:next.pageIndex,pageSize:next.pageSize})}}/>}
    </div>;
}
