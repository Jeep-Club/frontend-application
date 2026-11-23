import type { ComponentProps, ReactNode } from "react";
import { ChevronDown, ListFilter, type LucideIcon } from "lucide-react";

export function ProfileStatusSelect(props: Omit<ComponentProps<"select">, "className">) {
    return <div className="relative w-full lg:w-auto">
        <ListFilter size={16} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-(--accent-text)" />
        <select {...props} className="h-11 w-full cursor-pointer appearance-none rounded-xl border border-input-border bg-background-secondary pl-9 pr-9 text-sm font-semibold text-primary transition-colors hover:bg-background-tertiary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-input-border-focus [:root[data-theme=dark]_&]:scheme-dark" />
        <ChevronDown size={16} aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-secondary" />
    </div>;
}

export function ProfileTabHeader({ icon: Icon, title, description, action, filter }: {
    icon: LucideIcon;
    title: string;
    description: string;
    action: ReactNode;
    filter?: ReactNode;
}) {
    return <div className={`flex flex-col gap-4 ${filter ? "lg:flex-row lg:items-center lg:justify-between" : "sm:flex-row sm:items-center sm:justify-between"}`}>
        <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-j-blue-800 text-j-yellow-300 shadow-sm">
                <Icon size={23} aria-hidden="true" />
            </span>
            <div className="min-w-0">
                <h3 className="text-lg font-extrabold text-j-blue-800">{title}</h3>
                <p className="mt-0.5 text-sm text-j-gray-500">{description}</p>
            </div>
        </div>
        <div className={`flex w-full shrink-0 flex-col gap-2 ${filter ? "lg:w-auto lg:flex-row lg:items-center" : "sm:w-auto"}`}>
            {filter}
            <div className="w-full lg:w-auto">{action}</div>
        </div>
    </div>;
}

export function ProfileTabEmptyState({
    icon: Icon,
    title,
    description,
    emptyTitle,
    emptyDescription,
    action,
    filter,
}: {
    icon: LucideIcon;
    title: string;
    description: string;
    emptyTitle: string;
    emptyDescription: string;
    action: ReactNode;
    filter?: ReactNode;
}) {
    return (
        <section className="flex flex-col gap-5" aria-label={title}>
            <ProfileTabHeader icon={Icon} title={title} description={description} action={action} filter={filter} />

            <ProfileEmptyPanel icon={Icon} title={emptyTitle} description={emptyDescription} />
        </section>
    );
}

export function ProfileEmptyPanel({ icon: Icon, title, description }: { icon: LucideIcon; title: ReactNode; description?: string }) {
    return (
        <div className="flex min-h-52 flex-col items-center justify-center rounded-2xl border border-dashed border-j-gray-300 bg-j-white px-5 py-10 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-j-blue-50 text-j-blue-700">
                <Icon size={22} aria-hidden="true" />
            </span>
            <p className="mt-3 font-bold text-j-gray-700">{title}</p>
            {description && <p className="mt-1 max-w-md text-sm text-j-gray-500">{description}</p>}
        </div>
    );
}
