import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { expect, within } from "storybook/test";
import { EditMedicalProfileModal } from "./EditMedicalProfileModal";

function StoryQueryProvider({ children }: { children: ReactNode }) {
    const [client] = useState(() => new QueryClient());
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const meta = {
    title: "Páginas/Perfil/Dados médicos",
    component: EditMedicalProfileModal,
    decorators: [Story => <StoryQueryProvider><Story /></StoryQueryProvider>],
    args: { medicalProfile: null },
} satisfies Meta<typeof EditMedicalProfileModal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const RespostasCondicionais: Story = {
    play: async ({ canvas, userEvent }) => {
        const allergy = within(canvas.getByRole("group", { name: "Possui alguma alergia?" }));
        const yes = allergy.getByRole("button", { name: "Sim" });
        const no = allergy.getByRole("button", { name: "Não" });
        await expect(no).toHaveAttribute("aria-pressed", "true");
        await userEvent.click(yes);
        const details = canvas.getByRole("textbox", { name: "Quais alergias?" });
        await userEvent.type(details, "Amendoim");
        await userEvent.click(yes);
        await expect(details).toHaveValue("Amendoim");
        await userEvent.click(no);
        await expect(details).not.toBeInTheDocument();
    },
};
