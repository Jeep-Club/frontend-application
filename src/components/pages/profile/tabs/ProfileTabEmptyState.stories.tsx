import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect } from "storybook/test";
import { Button } from "@/components/common/button";
import { Car, HeartPulse, Plus } from "lucide-react";
import { ProfileStatusSelect, ProfileTabEmptyState } from "./ProfileTabEmptyState";

const meta = {
    title: "Páginas/Perfil/Estado vazio das abas",
    component: ProfileTabEmptyState,
    args: {
        icon: HeartPulse,
        title: "Meu perfil de saúde",
        description: "Informações úteis para seu cuidado e em caso de emergência.",
        emptyTitle: "Você ainda não cadastrou informações médicas",
        emptyDescription: "Inclua as informações de saúde e contatos de emergência no seu perfil.",
        action: <Button className="w-full"><Plus size={16} />Incluir informações</Button>,
    },
} satisfies Meta<typeof ProfileTabEmptyState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const PerfilMedicoVazio: Story = {
    play: async ({ canvas }) => {
        await expect(canvas.getByRole("heading", { name: "Meu perfil de saúde" })).toBeVisible();
        await expect(canvas.getByText("Você ainda não cadastrou informações médicas")).toBeVisible();
        await expect(canvas.getByRole("button", { name: "Incluir informações" })).toBeVisible();
    },
};

export const VeiculosVazio: Story = {
    args: {
        icon: Car,
        title: "Meus veículos",
        description: "Gerencie os veículos cadastrados no seu perfil.",
        emptyTitle: "Nenhum veículo ativo",
        filter: <ProfileStatusSelect aria-label="Situação dos veículos" defaultValue="ACTIVE"><option value="ACTIVE">Veículos ativos</option><option value="INACTIVE">Veículos inativos</option></ProfileStatusSelect>,
        emptyDescription: "Inclua seu veículo e mantenha os dados mais organizados no seu perfil.",
        action: <Button className="h-11 w-full justify-center rounded-xl px-5"><Plus size={16} aria-hidden="true" />Incluir veículo</Button>,
    },
};
