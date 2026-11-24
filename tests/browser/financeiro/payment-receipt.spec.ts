import { test, expect } from "../fixtures";
import { readLocalUrl } from "../../../config/local-urls.cjs";

const storyIds = {
    send: "páginas-financeiro-envio-de-comprovante--enviar",
    cash: "páginas-financeiro-envio-de-comprovante--em-dinheiro",
    cashWithReceipt: "páginas-financeiro-envio-de-comprovante--em-dinheiro-com-anexo",
    expired: "páginas-financeiro-envio-de-comprovante--expirada",
    canceled: "páginas-financeiro-envio-de-comprovante--cancelada",
    error: "páginas-financeiro-envio-de-comprovante--erro-de-envio",
};

function storyUrl(id: string, theme = "light") {
    const url = new URL("/iframe.html", readLocalUrl("PLAYWRIGHT_STORYBOOK_URL"));
    url.search = new URLSearchParams({ id, viewMode: "story", embed: "true", globals: `theme:${theme}` }).toString();
    return url.href;
}

const receipt = { name: "comprovante.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\ncomprovante sintético") };

for (const theme of ["light", "dark"]) {
    test(`Comprovante: envio para análise no tema ${theme}`, async ({ page }) => {
        await page.goto(storyUrl(storyIds.send, theme));
        const trigger = page.getByRole("button", { name: "Enviar comprovante", exact: true });
        await expect(trigger).toBeVisible();
        await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
        await trigger.focus();
        await trigger.press("Enter");
        await expect(page.getByRole("dialog", { name: "Enviar comprovante" })).toBeVisible();
        await page.getByRole("dialog").getByRole("spinbutton").first().focus();
        await page.keyboard.type("13112020");
        await page.getByLabel(/Hora do pagamento/).fill("15:30");
        await expect(page.getByRole("textbox", { name: "Valor do pagamento (R$)" })).toHaveValue("250,00");
        await page.getByLabel(/^Comprovante/).setInputFiles(receipt);
        await page.getByRole("textbox", { name: "Observações (opcional)" }).fill("Pagamento de teste");
        await page.getByRole("button", { name: "Enviar para análise" }).click();
        await expect(page.getByRole("status")).toContainText("Comprovante em análise");
        await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    });
}

test("Comprovante: cancelamento restaura foco e formato inválido impede envio", async ({ page }) => {
    await page.goto(storyUrl(storyIds.send));
    const trigger = page.getByRole("button", { name: "Enviar comprovante", exact: true });
    await trigger.click();
    await page.getByLabel(/^Comprovante/).setInputFiles({ name: "recibo.txt", mimeType: "text/plain", buffer: Buffer.from("inválido") });
    await expect(page.getByLabel(/^Comprovante/)).toHaveAccessibleDescription(/Envie um comprovante em PDF/);
    await expect(page.getByRole("button", { name: "Enviar para análise" })).toBeDisabled();
    await page.getByRole("button", { name: "Cancelar", exact: true }).click();
    await expect(trigger).toBeFocused();
    await expect(page.getByRole("dialog")).toBeHidden();
});

test("Comprovante: falha preserva dados para tentar novamente", async ({ page }) => {
    await page.goto(storyUrl(storyIds.error));
    await page.getByRole("button", { name: "Enviar comprovante", exact: true }).click();
    await page.getByRole("dialog").getByRole("spinbutton").first().focus();
    await page.keyboard.type("13112020");
    await page.getByLabel(/Hora do pagamento/).fill("15:30");
    await page.getByLabel(/^Comprovante/).setInputFiles(receipt);
    const notes = page.getByRole("textbox", { name: "Observações (opcional)" });
    await notes.fill("Manter observação");
    await page.getByRole("button", { name: "Enviar para análise" }).click();
    await expect(page.getByRole("alert")).toContainText("Tente novamente");
    await expect(notes).toHaveValue("Manter observação");
    await expect(page.getByRole("button", { name: "Enviar para análise" })).toBeEnabled();
});

test("Comprovante: dinheiro permite envio sem anexo e explica quando informar a data", async ({ page }) => {
    await page.goto(storyUrl(storyIds.cash));
    await page.getByRole("button", { name: "Enviar comprovante", exact: true }).click();
    const dialog = page.getByRole("dialog");
    const help = dialog.getByRole("button", { name: /Ajuda sobre a data/ });
    await help.press("Enter");
    await expect(dialog.getByText(/A data pode ser diferente/)).toBeVisible();
    await help.press("Escape");
    await expect(dialog.getByText(/A data pode ser diferente/)).toBeHidden();
    await expect(dialog).toBeVisible();
    await dialog.getByRole("combobox", { name: /Forma de pagamento/ }).click();
    await dialog.getByRole("option", { name: "Dinheiro", exact: true }).click();
    await expect(dialog.getByLabel(/^Comprovante/)).not.toHaveAttribute("required", "");
    await expect(dialog.getByLabel(/^Comprovante/)).toHaveAccessibleDescription(/conversa com o Matheus/);
    await dialog.getByRole("spinbutton").first().focus();
    await page.keyboard.type("13112020");
    await dialog.getByLabel(/Hora do pagamento/).fill("15:30");
    await dialog.getByRole("button", { name: "Enviar para análise" }).click();
    await expect(page.getByRole("status")).toContainText("Comprovante em análise");
});

test("Comprovante: dinheiro preserva o arquivo escolhido", async ({ page }) => {
    await page.goto(storyUrl(storyIds.cashWithReceipt));
    await page.getByRole("button", { name: "Enviar comprovante", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("combobox", { name: /Forma de pagamento/ }).click();
    await dialog.getByRole("option", { name: "Dinheiro", exact: true }).click();
    await dialog.getByRole("spinbutton").first().focus();
    await page.keyboard.type("13112020");
    await dialog.getByLabel(/Hora do pagamento/).fill("15:30");
    await dialog.getByLabel(/^Comprovante/).setInputFiles(receipt);
    await dialog.getByRole("button", { name: "Enviar para análise" }).click();
    await expect(page.getByRole("status")).toContainText("Comprovante em análise");
});

test("Comprovante: cobranças expiradas e canceladas explicam a indisponibilidade", async ({ page }) => {
    for (const id of [storyIds.expired, storyIds.canceled]) {
        await page.goto(storyUrl(id));
        const trigger = page.getByRole("button", { name: "Enviar comprovante", exact: true });
        await expect(trigger).toBeDisabled();
        await expect(trigger).toHaveAccessibleDescription(id === storyIds.expired ? /prazo de envio expirou/ : "Sua cobrança foi isentada. Você não precisa mais fazer o pagamento desta cobrança.");
    }
});
