import { test, expect } from "../fixtures";
import { readLocalUrl } from "../../../config/local-urls.cjs";

for (const theme of ["light", "dark"]) {
    test(`Visualiza o comprovante e devolve o foco no tema ${theme}`, async ({ page }) => {
        const url = new URL("/iframe.html", readLocalUrl("PLAYWRIGHT_STORYBOOK_URL"));
        url.search = new URLSearchParams({ id: "páginas-financeiro-visualização-de-comprovante--visualizar", viewMode: "story", embed: "true", globals: `theme:${theme}` }).toString();
        await page.goto(url.href);
        await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
        const trigger = page.getByRole("button", { name: "Comprovante", exact: true });
        await trigger.focus();
        await trigger.press("Enter");

        const dialog = page.getByRole("dialog", { name: "Comprovante do pagamento" });
        const image = dialog.getByRole("img", { name: "Comprovante do pagamento 12" });
        await expect(image).toBeVisible();
        await expect(image).toHaveJSProperty("naturalWidth", 1);
        const viewport = page.viewportSize()!;
        if (viewport.width < 640) {
            await expect.poll(() => dialog.boundingBox()).toEqual({ x: 0, y: 0, ...viewport });
        } else {
            await expect.poll(async () => (await dialog.boundingBox())?.width).toBeLessThan(viewport.width);
        }

        await page.keyboard.press("Escape");
        await expect(dialog).toBeHidden();
        await expect(trigger).toBeFocused();
    });
}
