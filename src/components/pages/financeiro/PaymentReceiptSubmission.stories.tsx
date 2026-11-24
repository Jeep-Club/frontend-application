import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { expect, fn, within } from "storybook/test";
import { PaymentReceiptSubmission } from "./PaymentReceiptSubmission";

const meta = {
    title: "Páginas/Financeiro/Envio de comprovante",
    component: PaymentReceiptSubmission,
    args: {
        charge: { id: 42, finalAmount: 250, effectiveStatus: "PENDING" },
        submitAction: fn(async () => ({ id: 100, status: "PENDING_VALIDATION" })),
    },
    argTypes: { charge: { control: false }, submitAction: { control: false } },
    parameters: { docs: { description: { component: "Envio de comprovante pela gestão de débitos com data e hora do pagamento em campos separados. Aceita PDF, JPEG, PNG ou WebP de até 10 MiB. Para dinheiro, o anexo é opcional e, quando ausente, uma declaração em PNG segue para análise. A operação é simulada nesta story." } } },
    decorators: [(Story) => {
        const [client] = useState(() => new QueryClient({ defaultOptions: { mutations: { retry: false } } }));
        return <QueryClientProvider client={client}><div className="max-w-2xl p-4"><Story /></div></QueryClientProvider>;
    }],
} satisfies Meta<typeof PaymentReceiptSubmission>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Enviar: Story = {
    play: async ({ canvas, canvasElement, userEvent, args }) => {
        await userEvent.click(canvas.getByRole("button", { name: "Enviar comprovante" }));
        const dialog = await canvas.findByRole("dialog", { name: "Enviar comprovante" });
        const segments = within(dialog).getAllByRole("spinbutton");
        segments[0].focus();
        await userEvent.keyboard("13112020");
        await userEvent.type(within(dialog).getByLabelText(/Hora do pagamento/), "15:30");
        const input = within(dialog).getByLabelText(/^Comprovante/);
        if (!(input instanceof canvasElement.ownerDocument.defaultView!.HTMLInputElement)) throw new Error("Campo de arquivo não encontrado");
        // A lista nativa precisa alimentar a validação do navegador e o FormData.
        const files = new DataTransfer();
        files.items.add(new File(["%PDF-1.4\ncomprovante de teste"], "comprovante.pdf", { type: "application/pdf" }));
        input.files = files.files;
        input.dispatchEvent(new Event("change", { bubbles: true }));
        await userEvent.click(within(dialog).getByRole("button", { name: "Enviar para análise" }));
        await expect(await canvas.findByRole("status")).toHaveTextContent("Comprovante em análise");
        await expect(args.submitAction).toHaveBeenCalledWith(42, expect.any(FormData));
    },
};

export const EmDinheiro: Story = {
    args: {
        submitAction: fn(async (_chargeId: number, form: FormData) => {
            const receipt = form.get("receiptFile");
            if (form.get("paymentMethod") !== "CASH" || !(receipt instanceof File) || receipt.name !== "declaracao-pagamento-em-dinheiro.png" || receipt.type !== "image/png" || !receipt.size) {
                throw new Error("A declaração de pagamento em dinheiro deveria acompanhar o envio.");
            }
            return { id: 101, status: "PENDING_VALIDATION" };
        }),
    },
};

export const EmDinheiroComAnexo: Story = {
    args: {
        submitAction: fn(async (_chargeId: number, form: FormData) => {
            const receipt = form.get("receiptFile");
            if (form.get("paymentMethod") !== "CASH" || !(receipt instanceof File) || receipt.name !== "comprovante.pdf" || receipt.type !== "application/pdf") {
                throw new Error("O envio deveria manter o comprovante selecionado.");
            }
            return { id: 102, status: "PENDING_VALIDATION" };
        }),
    },
};

export const Expirada: Story = { args: { charge: { id: 43, finalAmount: 250, effectiveStatus: "EXPIRED" } } };
export const Cancelada: Story = { args: { charge: { id: 44, finalAmount: 250, effectiveStatus: "CANCELED" } } };
export const ErroDeEnvio: Story = {
    args: { submitAction: fn(async () => { throw new Error("Não foi possível enviar. Tente novamente."); }) },
};
