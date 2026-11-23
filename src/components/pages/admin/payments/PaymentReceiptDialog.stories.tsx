import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { spyOn } from "storybook/test";
import PaymentReceiptDialog from "./PaymentReceiptDialog";

const meta = {
    title: "Páginas/Financeiro/Visualização de comprovante",
    component: PaymentReceiptDialog,
    args: { paymentId: 12 },
    beforeEach: () => {
        const originalFetch = window.fetch.bind(window);
        const stub = spyOn(window, "fetch").mockImplementation((input, init) => {
            if (input !== "/api/payments/12/receipt") return originalFetch(input, init);
            const image = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jrZkAAAAASUVORK5CYII="), character => character.charCodeAt(0));
            return Promise.resolve(new Response(image, { headers: { "Content-Type": "image/png" } }));
        });
        return () => { stub.mockRestore(); };
    },
} satisfies Meta<typeof PaymentReceiptDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Visualizar: Story = {};
