import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";
import type { BillingRecord } from "@/schemas/billing/management";
import { BillingRecordModal } from "./BillingRecordModal";

const record = {
    id: 1,
    status: "CONFIRMED",
    memberChargeId: 2,
    amount: 100,
    paymentMethod: "CASH",
    paidAt: "2026-11-22T13:00:00Z",
    dueDate: "2026-11-23",
    userName: "Marina da Silva",
    chargeDefinitionNameSnapshot: "Anuidade",
    chargeCycleCode: "Anuidade 2026",
    updatedAt: "2026-11-22T14:00:00Z",
} satisfies BillingRecord;

const meta = {
    title: "Páginas/Admin/Gestão financeira/Detalhes de movimentações",
    component: BillingRecordModal,
    parameters: { layout: "padded" },
} satisfies Meta<typeof BillingRecordModal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const PagamentoConfirmado: Story = {
    args: { resource: "payments", id: 1, title: "Detalhes" },
    render: args => {
        const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } });
        client.setQueryData(["billing", args.resource, args.id], record);
        return <QueryClientProvider client={client}><BillingRecordModal {...args} /></QueryClientProvider>;
    },
    async play({ canvasElement }) {
        const dialog = within(within(canvasElement).getByRole("dialog", { name: "Detalhes do pagamento" }));
        const labels = dialog.getAllByRole("term").map(term => term.textContent);
        await expect(labels.slice(0, 6)).toEqual(["Cobrança", "Ciclo", "Pago em", "Vencimento", "Valor", "Situação"]);
        await expect(labels.slice(-2)).toEqual(["Código do registro", "Código da cobrança"]);
    },
};
