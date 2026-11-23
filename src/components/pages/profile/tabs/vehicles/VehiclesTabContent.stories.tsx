import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { VehiclesTabContent } from "./VehiclesTabContent";

function VehicleListFixture({ children }: { children: ReactNode }) {
    const [client] = useState(() => {
        const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } });
        queryClient.setQueryData<ListVehicleMemberResponse>(["vehicles", "list-member", 0, 10, false], {
            content: [{ id: 12, nickname: "Minha caminhonete de trilha", model: "Modelo com nome comprido", plate: "ESC1B23", photo: null, photos: [], color: "Vinho metálico escuro", modelYear: 2011, status: "ACTIVE", ownerId: 1 }],
            number: 0, size: 10, totalPages: 1, totalElements: 1, numberOfElements: 1, first: true, last: true, empty: false,
        });
        return queryClient;
    });
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const meta = {
    title: "Páginas/Perfil/Veículos",
    component: VehiclesTabContent,
    decorators: [Story => <VehicleListFixture><Story /></VehicleListFixture>],
} satisfies Meta<typeof VehiclesTabContent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const TextosLongos: Story = {};
