import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ProfileTabLoading } from "./ProfileTabLoading";

const meta = {
    title: "Páginas/Perfil/Carregamento das abas",
    component: ProfileTabLoading,
    args: { tab: "personal" },
} satisfies Meta<typeof ProfileTabLoading>;

export default meta;
type Story = StoryObj<typeof meta>;

export const DadosPessoais: Story = {};
export const PerfilDeSaude: Story = { args: { tab: "medical" } };
export const Dependentes: Story = { args: { tab: "dependents" } };
export const Veiculos: Story = { args: { tab: "vehicles" } };
export const Ferramentas: Story = { args: { tab: "tools" } };
