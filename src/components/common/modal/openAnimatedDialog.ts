export function openAnimatedDialog(dialog: HTMLDialogElement, trigger: HTMLElement) {
    if (dialog.open) return;

    const start = trigger.getBoundingClientRect();
    dialog.showModal();
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const end = dialog.getBoundingClientRect();
    dialog.animate([
        { transform: `translate(${start.left - end.left}px, ${start.top - end.top}px) scale(${start.width / end.width}, ${start.height / end.height})`, opacity: 0.65 },
        { transform: "none", opacity: 1 },
    ], { duration: 250, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" });
}
