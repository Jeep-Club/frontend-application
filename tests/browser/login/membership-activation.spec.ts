import { test, expect } from '../fixtures';

test('Ativação de Membership sem token não exibe formulário e orienta reenvio', async ({ page }) => {
    await page.goto('/membership/activate');
    await expect(page.getByRole('heading', { name: 'Convite indisponível' })).toBeVisible();
    await expect(page.getByRole('main').getByRole('alert')).toContainText('Solicite à administração o reenvio');
    await expect(page.getByLabel(/^Nova senha/)).toHaveCount(0);
    await page.getByRole('button', { name: 'Ir para o login' }).click();
    await expect(page).toHaveURL(/\/login$/);
});
