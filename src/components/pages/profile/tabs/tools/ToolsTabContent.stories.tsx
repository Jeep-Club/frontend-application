import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { expect } from "storybook/test";
import { ToolsTabContent } from "./ToolsTabContent";

function FilterFixture({ children }: { children: ReactNode }) {
    const [client] = useState(() => {
        const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } });
        const tools: ToolListItem[] = [
            { id: 1, name: "Macaco hidráulico", status: "ACTIVE", photoStorageKey: null },
            { id: 2, name: "Cinta de reboque", status: "INACTIVE", photoStorageKey: null },
        ];
        for (const status of ["ACTIVE", "INACTIVE", "ARCHIVED"] as const) {
            const content = tools.filter(tool => tool.status === status);
            queryClient.setQueryData<ListToolsResponse>(["tools", "list", 0, 10, status], {
                content, number: 0, size: 10, totalPages: content.length, totalElements: content.length,
                numberOfElements: content.length, first: true, last: true, empty: !content.length,
            });
        }
        return queryClient;
    });
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const meta = {
    title: "Páginas/Perfil/Ferramentas",
    component: ToolsTabContent,
    decorators: [Story => <FilterFixture><Story /></FilterFixture>],
} satisfies Meta<typeof ToolsTabContent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const FiltroDeSituacao: Story = {
    play: async ({ canvas, userEvent }) => {
        const filter = canvas.getByRole("combobox", { name: "Situação das ferramentas" });
        await expect(filter).toHaveValue("ACTIVE");
        await userEvent.selectOptions(filter, "INACTIVE");
        await expect(canvas.getByRole("heading", { name: "Cinta de reboque" })).toBeVisible();
        await userEvent.selectOptions(filter, "ARCHIVED");
        await expect(canvas.getByText("Nenhuma ferramenta arquivada")).toBeVisible();
        await expect(filter).toBeVisible();
    },
};
