import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect } from "storybook/test";
import { ToolsLoadingCard } from "./ToolsLoadingCard";

const meta = {
    title: "Páginas/Ferramentas/Carregamento",
    component: ToolsLoadingCard,
    args: { context: "management" },
    argTypes: { context: { control: "radio", options: ["management", "profile"] } },
    parameters: {
        docs: {
            description: {
                component: "Cartão de carregamento das listas de ferramentas da gestão administrativa e do perfil do associado. O contexto altera a mensagem semântica; o indicador anuncia o progresso.",
            },
        },
    },
} satisfies Meta<typeof ToolsLoadingCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Gestao: Story = {
    play: async ({ canvas }) => {
        await expect(canvas.getByRole("status")).toHaveTextContent("Carregando ferramentas da gestão...");
        await expect(canvas.getByText("Organizando as ferramentas do clube.")).toBeVisible();
    },
};

export const Perfil: Story = {
    args: { context: "profile" },
    play: async ({ canvas }) => {
        await expect(canvas.getByRole("status")).toHaveTextContent("Carregando suas ferramentas...");
        await expect(canvas.getByText("Tudo pronto para a próxima trilha.")).toBeVisible();
    },
};
