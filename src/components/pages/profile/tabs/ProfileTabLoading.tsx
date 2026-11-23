import { Car, HeartPulse, LoaderCircle, UserRound, Users, Wrench } from "lucide-react";

const tabs = {
    personal: { icon: UserRound, title: "Dados pessoais", label: "Carregando dados pessoais..." },
    medical: { icon: HeartPulse, title: "Perfil de saúde", label: "Carregando perfil médico..." },
    dependents: { icon: Users, title: "Meus dependentes", label: "Carregando dependentes..." },
    vehicles: { icon: Car, title: "Meus veículos", label: "Carregando veículos..." },
    tools: { icon: Wrench, title: "Minhas ferramentas", label: "Carregando suas ferramentas..." },
};

export function ProfileTabLoading({ tab, title, label }: { tab: keyof typeof tabs; title?: string; label?: string }) {
    const { icon: Icon, ...copy } = tabs[tab];

    return (
        <div role="status" aria-live="polite" className="grid min-h-64 w-full place-items-center rounded-2xl bg-background-secondary px-4 py-8 sm:min-h-72">
            <div className="flex w-full max-w-sm flex-col items-center gap-3 rounded-3xl border border-input-border bg-background px-5 py-7 text-center shadow-xl sm:px-8 sm:py-8">
                <span className="grid size-12 place-items-center rounded-2xl bg-j-yellow-300 text-[#061e50]">
                    <Icon size={25} aria-hidden="true" />
                </span>
                <p className="text-lg font-extrabold leading-snug text-primary sm:text-xl">{title ?? copy.title}</p>
                <span className="inline-flex items-center gap-2 text-sm text-secondary">
                    <LoaderCircle size={16} aria-hidden="true" className="shrink-0 motion-safe:animate-spin motion-reduce:animate-none" />
                    {label ?? copy.label}
                </span>
            </div>
        </div>
    );
}
