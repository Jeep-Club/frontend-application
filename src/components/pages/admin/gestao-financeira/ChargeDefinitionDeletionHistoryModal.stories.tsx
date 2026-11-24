import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, mocked, userEvent, within } from "storybook/test";
import { getChargeDefinitionDeletionHistoryAction } from "@/server/actions/billing/chargeDefinitions/deletionHistory";
import { ChargeDefinitionDeletionHistoryModal } from "./ChargeDefinitionDeletionHistoryModal";

const meta = {
    title: "Páginas/Admin/Gestão financeira/Histórico de exclusão",
    component: ChargeDefinitionDeletionHistoryModal,
    parameters: { layout: "centered" },
} satisfies Meta<typeof ChargeDefinitionDeletionHistoryModal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ComAutorIdentificado: Story = {
    beforeEach() {
        mocked(getChargeDefinitionDeletionHistoryAction).mockResolvedValue({
            originalId: 42,
            name: "Anuidade 2025",
            description: "Configuração original",
            defaultAmount: 100,
            recurrenceType: "YEARLY",
            required: true,
            paymentAcceptancePolicy: "UNTIL_DUE_DATE",
            previousStatus: "ARCHIVED",
            createdAt: "2025-01-10T12:00:00Z",
            deletedByUserId: 10,
            deletedByUserName: "Marina da Silva",
            deletedAt: "2025-11-10T12:00:00Z",
            reason: "ADMINISTRATIVE_DELETE",
            schemaVersion: 1,
        });
    },
    async play({ canvasElement }) {
        const canvas = within(canvasElement);
        await userEvent.click(canvas.getByRole("button", { name: "Histórico de exclusão" }));
        const dialog = within(canvas.getByRole("dialog", { name: "Histórico de exclusão" }));
        await userEvent.type(dialog.getByRole("spinbutton", { name: "Código original da definição" }), "42");
        await userEvent.click(dialog.getByRole("button", { name: "Consultar" }));
        await expect(dialog.findByText("Marina da Silva")).resolves.toBeVisible();
    },
};
