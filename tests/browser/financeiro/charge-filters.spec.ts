import { test, expect } from '../feed/fixtures';

test('separa situações calculadas antes da paginação e mantém os demais filtros', async ({ page, api }) => {
    await page.goto('/financeiro');
    const status = page.getByLabel('Status da cobrança');
    await status.selectOption('OVERDUE');
    await expect(page.getByText('Cobrança #53', { exact: true })).toBeVisible();
    await expect(page.getByText('Cobrança #54', { exact: true })).toHaveCount(0);
    expect(api.calls.some(url => url.pathname === '/billing/me/member-charges' && url.searchParams.get('status') === 'PENDING' && url.searchParams.get('page') === '1')).toBe(true);

    await status.selectOption('EXPIRED');
    await expect(page.getByText('Cobrança #54', { exact: true })).toBeVisible();
    await expect(page.getByText('Cobrança #53', { exact: true })).toHaveCount(0);

    await status.selectOption('PENDING');
    await expect(page.getByText('Cobrança #1', { exact: true })).toBeVisible();
    await expect(page.getByText('Página 1 de 6')).toBeVisible();
    await page.getByRole('link', { name: 'Próxima' }).click();
    await expect(page.getByText('Cobrança #11', { exact: true })).toBeVisible();
    await expect(page.getByText('Página 2 de 6')).toBeVisible();

    await status.selectOption('PAID');
    await expect(page.getByText('Cobrança #55', { exact: true })).toBeVisible();
    await expect(page.getByText('Cobrança #56', { exact: true })).toHaveCount(0);
    await status.selectOption('CANCELED');
    await expect(page.getByText('Cobrança #56', { exact: true })).toBeVisible();
});
