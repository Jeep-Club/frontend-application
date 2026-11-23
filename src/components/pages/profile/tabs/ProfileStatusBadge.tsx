const statusColors = {
    ACTIVE: "border-(--success-border) bg-(--success-surface) text-(--success-text)",
    INACTIVE: "border-amber-300 bg-amber-50 text-amber-900 [:root[data-theme=dark]_&]:border-amber-300/40 [:root[data-theme=dark]_&]:bg-amber-300/10 [:root[data-theme=dark]_&]:text-amber-200",
    ARCHIVED: "border-input-border bg-background-secondary text-secondary",
};

export function ProfileStatusBadge({ status, label, className }: { status: keyof typeof statusColors; label: string; className: string }) {
    return <span className={`w-fit rounded-full border px-2 py-0.5 text-xs font-semibold ${statusColors[status]} ${className}`}>{label}</span>;
}
