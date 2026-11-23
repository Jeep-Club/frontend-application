import { test, expect } from './fixtures';

test('conta mantém o painel dentro da tela e rola apenas o conteúdo', async ({ page }) => {
    await page.setViewportSize({ width: page.viewportSize()!.width, height: 600 });
    await page.goto('/profile');
    await expect(page.getByRole('heading', { name: 'Carteirinha digital' })).toBeVisible();

    const dimensions = await page.evaluate(() => {
        const shell = document.querySelector('[data-dashboard-shell]')!.getBoundingClientRect();
        return { documentHeight: document.documentElement.scrollHeight, viewportHeight: document.documentElement.clientHeight, shellTop: shell.top, shellBottom: shell.bottom };
    });
    expect(dimensions.documentHeight).toBe(dimensions.viewportHeight);
    expect(dimensions.shellTop).toBe(0);
    expect(dimensions.shellBottom).toBe(dimensions.viewportHeight);

    const scroll = page.locator('[data-dashboard-scroll]');
    await expect.poll(() => scroll.evaluate(element => element.scrollHeight > element.clientHeight)).toBe(true);
    await scroll.hover();
    await page.mouse.wheel(0, 800);
    await expect.poll(() => scroll.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
});

test('navegação para conta mantém painel fixo no viewport', async ({ page }) => {
    await page.goto('/feed');
    const link = page.locator('#tour-avatar-container');
    await link.click();
    await expect(page.getByRole('heading', { name: 'Carteirinha digital' })).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollHeight - document.documentElement.clientHeight)).toBe(0);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
});

test('carteirinha continua disponível para exportação', async ({ page }) => {
    await page.goto('/profile');
    const exportButton = page.getByRole('button', { name: 'PNG', exact: true });
    await expect(exportButton).toBeEnabled();
    await exportButton.click();
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: /Somente frente/ }).click();
    expect((await download).suggestedFilename()).toMatch(/\.png$/);
});
