import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { expect, fn, within } from "storybook/test";
import { ModalProvider } from "@/providers/ModalProvider";
import { RecordStatusAction } from "./RecordStatusAction";

function Providers({ children }: { children: ReactNode }) {
    const [client] = useState(() => new QueryClient());
    return <QueryClientProvider client={client}><ModalProvider>{children}</ModalProvider></QueryClientProvider>;
}

const meta = {
    title: "Componentes/Ação de status",
    component: RecordStatusAction,
    decorators: [Story => <Providers><Story /></Providers>],
    args: { name: "Veículo de exemplo", active: true, queryKeys: [["story-status"]], onConfirm: fn(async () => undefined) },
} satisfies Meta<typeof RecordStatusAction>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Inativar: Story = {
    play: async ({ canvas, canvasElement, args, userEvent }) => {
        const page = within(canvasElement.ownerDocument.body);
        await userEvent.click(canvas.getByRole("button", { name: "Inativar Veículo de exemplo" }));
        const dialog = await page.findByRole("dialog", { name: "Inativar cadastro?" });
        await expect(args.onConfirm).not.toHaveBeenCalled();
        await userEvent.click(within(dialog).getByRole("button", { name: "Inativar" }));
        await expect(args.onConfirm).toHaveBeenCalledTimes(1);
    },
};

export const Conflito: Story = {
    args: { onConfirm: fn(async () => { throw new Error("O veículo tem participação em um evento aberto."); }) },
};
