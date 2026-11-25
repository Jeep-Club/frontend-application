import { Eye, UserRound, Users } from "lucide-react";
import { Avatar } from "@/components/common/avatar";
import { getAdminDependentPhotoUrl, formatDependentBirthDate, DEPENDENT_RELATIONSHIP_LABEL, DEPENDENT_STATUS_BADGE_CLASS, DEPENDENT_STATUS_LABEL } from "./dependentDisplay";


function FamilyMemberCard({
    relative,
    selected,
    parent = false,
    onOpenDependent,
}: {
    relative: AdminDependentItem;
    selected: boolean;
    parent?: boolean;
    onOpenDependent: (dependent: AdminDependentItem) => void;
}) {
    const photoUrl = getAdminDependentPhotoUrl(relative);

    return <li className={`min-w-0 rounded-2xl border p-3 shadow-xs ${parent ? "border-j-blue-300 bg-j-blue-50/70" : "border-j-gray-200 bg-j-white"} ${selected ? "ring-2 ring-j-blue-700/25" : ""}`}>
        <div className="flex min-w-0 items-center gap-3">
            {photoUrl ? <Avatar src={photoUrl} alt={`Foto de ${relative.name}`} className="h-14 w-14 shrink-0 rounded-xl bg-j-gray-100" /> : <span aria-hidden="true" className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-j-blue-800 text-j-yellow-300"><UserRound size={22} /></span>}
            <div className="min-w-0 flex-1">
                <p className="break-words font-bold leading-tight text-j-blue-800">{relative.name}</p>
                <p className="mt-1 text-sm text-j-gray-600">{DEPENDENT_RELATIONSHIP_LABEL[relative.relationshipType] ?? relative.relationshipType}</p>
                <p className="mt-1 text-xs text-j-gray-500">Nasc.: {formatDependentBirthDate(relative.birthDate)}</p>
            </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-j-gray-200/80 pt-3">
            <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${DEPENDENT_STATUS_BADGE_CLASS[relative.status]}`}>{DEPENDENT_STATUS_LABEL[relative.status]}</span>
                {selected && <span className="rounded-full bg-j-blue-100 px-2.5 py-1 text-xs font-semibold text-j-blue-800">Selecionado</span>}
            </div>
            <button type="button" onClick={() => onOpenDependent(relative)} aria-label={`Abrir cadastro de ${relative.name}`} className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-j-blue-800 transition-colors hover:bg-j-blue-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-j-blue-800"><Eye size={15} aria-hidden="true" />Ver cadastro</button>
        </div>
    </li>;
}


export function DependentFamilyTreeView({
    ownerName,
    ownerPhotoUrl,
    ownerId,
    relatives,
    selectedDependentId,
    onOpenDependent,
}: {
    ownerName?: string | null;
    ownerPhotoUrl?: string | null;
    ownerId: number;
    relatives: AdminDependentItem[];
    selectedDependentId: number;
    onOpenDependent: (dependent: AdminDependentItem) => void;
}) {
    const displayOwner = ownerName?.trim() || `Titular #${ownerId}`;

    const parents = relatives.filter((relative) => relative.relationshipType === "PARENT");
    const sameGeneration = relatives.filter((relative) => relative.relationshipType === "SIBLING" || relative.relationshipType === "SPOUSE");
    const children = relatives.filter((relative) => relative.relationshipType === "CHILD");
    const otherRelatives = relatives.filter((relative) => relative.relationshipType === "GUEST" || relative.relationshipType === "OTHER");

    return <div className="min-w-0 space-y-4">
        <h3 className="flex items-center gap-2 font-bold text-j-blue-800"><Users size={18} aria-hidden="true" />Familiares cadastrados <span className="rounded-full bg-j-gray-100 px-2 py-0.5 text-xs font-semibold text-j-gray-600">{relatives.length}</span></h3>
        {parents.length > 0 && <section aria-label="Familiares ascendentes">
                <h3 className="mb-3 text-center text-sm font-bold text-j-blue-800">Pais do titular</h3>
                <ul className={`mx-auto grid w-full ${parents.length === 1 ? "max-w-xl" : "max-w-3xl"} grid-cols-1 gap-3 ${parents.length > 1 ? "sm:grid-cols-2" : ""}`}>
                    {parents.map((relative) => <FamilyMemberCard key={relative.id} relative={relative} parent selected={relative.id === selectedDependentId} onOpenDependent={onOpenDependent} />)}
                </ul>
                <div aria-hidden="true" className="mx-auto h-5 w-px bg-j-blue-300" />
        </section>}

        <section aria-label="Titular, cônjuge e irmãos" className="space-y-3">
            <h3 className="text-center text-sm font-bold text-j-blue-800">Núcleo do titular</h3>
            <ul className="mx-auto grid w-full max-w-4xl grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <li className={`mx-auto flex min-w-0 w-full items-center gap-3 rounded-2xl border-2 border-j-blue-800 bg-j-blue-800 p-4 text-j-white shadow-sm ${sameGeneration.length ? "sm:col-span-2 lg:col-span-1" : "max-w-xl sm:col-span-2 lg:col-span-3"}`}>
                    {ownerPhotoUrl ? <Avatar src={ownerPhotoUrl} alt={`Foto de ${displayOwner}`} className="h-12 w-12 shrink-0 rounded-full bg-j-white/15" /> : <span aria-hidden="true" className="flex size-12 shrink-0 items-center justify-center rounded-full bg-j-white/15 text-j-yellow-300"><UserRound size={23} /></span>}
                    <span className="min-w-0"><span className="block text-xs font-semibold uppercase tracking-wide text-j-white/75">Titular</span><span className="block break-words font-bold">{displayOwner}</span><span className="block text-xs text-j-white/75">Associado #{ownerId}</span></span>
                </li>
                {sameGeneration.map((relative) => <FamilyMemberCard key={relative.id} relative={relative} selected={relative.id === selectedDependentId} onOpenDependent={onOpenDependent} />)}
            </ul>
        </section>

        {children.length > 0 && <>
            <div aria-hidden="true" className="mx-auto h-5 w-px bg-j-blue-300" />
            <section aria-label="Filhos do titular" className="space-y-3">
                <h3 className="text-center text-sm font-bold text-j-blue-800">Filhos do titular</h3>
                <ul className={`mx-auto grid w-full ${children.length === 1 ? "max-w-md" : "max-w-4xl"} grid-cols-1 gap-3 ${children.length > 1 ? "sm:grid-cols-2 lg:grid-cols-3" : ""}`}>
                    {children.map((relative) => <FamilyMemberCard key={relative.id} relative={relative} selected={relative.id === selectedDependentId} onOpenDependent={onOpenDependent} />)}
                </ul>
            </section>
        </>}

        {otherRelatives.length > 0 && <section aria-label="Outros familiares cadastrados" className="space-y-3 border-t border-j-gray-200 pt-4">
            <h3 className="text-sm font-bold text-j-blue-800">Outros familiares cadastrados</h3>
            <ul className={`grid min-w-0 grid-cols-1 gap-3 ${otherRelatives.length > 1 ? "sm:grid-cols-2 lg:grid-cols-3" : "mx-auto w-full max-w-md"}`}>
                {otherRelatives.map((relative) => <FamilyMemberCard key={relative.id} relative={relative} selected={relative.id === selectedDependentId} onOpenDependent={onOpenDependent} />)}
            </ul>
        </section>}

        {relatives.length === 0 && <p className="rounded-xl border border-dashed border-j-gray-300 p-5 text-sm text-j-gray-600">Nenhum familiar encontrado para este titular.</p>}

        <p className="rounded-xl bg-j-gray-100 p-3 text-xs leading-relaxed text-j-gray-600">A posição dos cards usa o parentesco cadastrado em relação ao titular. O sistema não registra vínculos diretos entre dependentes nem diferencia pai de mãe, então não presume relações mais específicas do que as informadas no cadastro.</p>

    </div>;
}
