import { Eye, UserRound, Users } from "lucide-react";
import { Avatar } from "@/components/common/avatar";
import { getAdminDependentPhotoUrl, formatDependentBirthDate, DEPENDENT_RELATIONSHIP_LABEL, DEPENDENT_STATUS_BADGE_CLASS, DEPENDENT_STATUS_LABEL } from "./dependentDisplay";

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

    return <div className="min-w-0 space-y-5">
        <section aria-label={`Titular da família: ${displayOwner}`} className="mx-auto flex w-full max-w-xl items-center gap-3 rounded-2xl border-2 border-j-blue-800 bg-j-blue-800 p-4 text-j-white shadow-sm">
            {ownerPhotoUrl ? <Avatar src={ownerPhotoUrl} alt={`Foto de ${displayOwner}`} className="h-12 w-12 shrink-0 rounded-full bg-j-white/15" /> : <span aria-hidden="true" className="flex size-12 shrink-0 items-center justify-center rounded-full bg-j-white/15 text-j-yellow-300"><UserRound size={23} /></span>}
            <span className="min-w-0"><span className="block text-xs font-semibold uppercase tracking-wide text-j-white/75">Titular</span><span className="block break-words font-bold">{displayOwner}</span><span className="block text-xs text-j-white/75">Associado #{ownerId}</span></span>
        </section>

        <div aria-hidden="true" className="mx-auto h-5 w-px bg-j-gray-300" />

        <section aria-labelledby="dependent-family-members-heading" className="space-y-3">
            <h3 id="dependent-family-members-heading" className="flex items-center gap-2 font-bold text-j-blue-800"><Users size={18} aria-hidden="true" />Familiares cadastrados <span className="rounded-full bg-j-gray-100 px-2 py-0.5 text-xs font-semibold text-j-gray-600">{relatives.length}</span></h3>
            {relatives.length ? <ul className="grid min-w-0 gap-3 sm:grid-cols-2">
                {relatives.map((relative) => {
                    const photoUrl = getAdminDependentPhotoUrl(relative);
                    const selected = relative.id === selectedDependentId;
                    return <li key={relative.id} className={`relative min-w-0 rounded-2xl border bg-j-white p-3 shadow-xs transition-shadow duration-200 motion-safe:hover:shadow-sm ${selected ? "border-j-blue-700 ring-2 ring-j-blue-700/15" : "border-j-gray-200"}`}>
                        <div className="flex min-w-0 items-center gap-3">
                            {photoUrl ? <Avatar src={photoUrl} alt={`Foto de ${relative.name}`} className="h-14 w-14 shrink-0 rounded-xl bg-j-gray-100" /> : <span aria-hidden="true" className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-j-blue-800 text-j-yellow-300"><UserRound size={22} /></span>}
                            <div className="min-w-0 flex-1">
                                <p className="break-words font-bold leading-tight text-j-blue-800">{relative.name}</p>
                                <p className="mt-1 text-sm text-j-gray-600">{DEPENDENT_RELATIONSHIP_LABEL[relative.relationshipType] ?? relative.relationshipType}</p>
                                <p className="mt-1 text-xs text-j-gray-500">Nasc.: {formatDependentBirthDate(relative.birthDate)}</p>
                            </div>
                        </div>
                        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-j-gray-100 pt-3">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${DEPENDENT_STATUS_BADGE_CLASS[relative.status]}`}>{DEPENDENT_STATUS_LABEL[relative.status]}</span>
                                {selected && <span className="rounded-full bg-j-blue-50 px-2.5 py-1 text-xs font-semibold text-j-blue-800">Selecionado</span>}
                            </div>
                            <button type="button" onClick={() => onOpenDependent(relative)} aria-label={`Abrir cadastro de ${relative.name}`} className="inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-j-blue-800 transition-colors hover:bg-j-blue-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-j-blue-800"><Eye size={15} aria-hidden="true" />Ver cadastro</button>
                        </div>
                    </li>;
                })}
            </ul> : <p className="rounded-xl border border-dashed border-j-gray-300 p-5 text-sm text-j-gray-600">Nenhum familiar encontrado para este titular.</p>}
        </section>

        <p className="rounded-xl bg-j-gray-100 p-3 text-xs leading-relaxed text-j-gray-600">O cadastro atual informa o parentesco de cada dependente com o titular. Ele não informa vínculos entre dependentes, então esta árvore não presume relações de pais, filhos ou netos entre eles.</p>
    </div>;
}
