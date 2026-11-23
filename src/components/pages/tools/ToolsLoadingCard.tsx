import { LoaderCircle, Wrench } from "lucide-react";

type ToolsLoadingContext = "management" | "profile";

const COPY: Record<ToolsLoadingContext, { title: string; label: string }> = {
    management: {
        title: "Organizando as ferramentas do clube.",
        label: "Carregando ferramentas da gestão...",
    },
    profile: {
        title: "Tudo pronto para a próxima trilha.",
        label: "Carregando suas ferramentas...",
    },
};

/** Loading card shared by the admin and member tools lists, with context-specific copy. */
export function ToolsLoadingCard({ context }: { context: ToolsLoadingContext }) {
    const copy = COPY[context];

    return (
        <div role="status" aria-live="polite" aria-busy="true" className="grid min-h-64 w-full place-items-center rounded-2xl bg-background-secondary px-4 py-8 sm:min-h-72">
            <div className="flex w-full max-w-sm flex-col items-center gap-3 rounded-3xl border border-input-border bg-background px-5 py-7 text-center shadow-xl sm:px-8 sm:py-8">
                <span className="grid size-12 place-items-center rounded-2xl bg-j-yellow-300 text-[#061e50]">
                    <Wrench size={25} aria-hidden="true" />
                </span>
                <p className="text-lg font-extrabold leading-snug text-primary sm:text-xl">{copy.title}</p>
                <span className="inline-flex items-center gap-2 text-sm text-secondary">
                    <LoaderCircle size={16} aria-hidden="true" className="shrink-0 motion-safe:animate-spin motion-reduce:animate-none" />
                    {copy.label}
                </span>
            </div>
        </div>
    );
}
