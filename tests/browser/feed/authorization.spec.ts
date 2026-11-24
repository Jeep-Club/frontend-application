import { SignJWT } from 'jose';
import { test, expect } from './fixtures';
import { readLocalUrl } from '../../../config/local-urls.cjs';
import type { Page } from '@playwright/test';

async function grant(page: Page, authorities: string[]) {
    const modules = new Map<string, string[]>();
    for (const authority of authorities) {
        const [module, ...action] = authority.split('_');
        modules.set(module, [...(modules.get(module) ?? []), action.join('_')]);
    }
    const value = await new SignJWT({ data: [...modules].map(([module, actions]) => ({ module, actions })) }).setProtectedHeader({ alg: 'HS256' }).setExpirationTime('1h').sign(new TextEncoder().encode('playwright-local-session-not-for-production'));
    await page.context().addCookies([{ name: 'Permissions', value, url: readLocalUrl('PLAYWRIGHT_APP_URL').origin, httpOnly: true }]);
}

test('HEALTH export-only exposes export controls without requesting clinical data', async ({ page, api }) => {
    await grant(page, ['HEALTH_MEDICAL_PROFILE_EXPORT']);
    await page.goto('/admin/dados-medicos');
    await expect(page.getByRole('button', { name: 'Exportar', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Exportar', exact: true }).click();
    await expect(page.getByRole('menuitem', { name: 'Planilha CSV', exact: true })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'PDF', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cadastrar perfil', exact: true })).toHaveCount(0);
    expect(api.calls.some(url => url.pathname.includes('medical-profiles'))).toBe(false);
});

test('emergency permission does not grant general HEALTH access or exports', async ({ page, api }) => {
    await grant(page, ['PUBLICATIONS_EVENT_HEALTH_EMERGENCY_READ']);
    await page.goto('/admin/dados-medicos');
    await expect(page.getByRole('heading', { name: 'Parece que saímos da trilha.' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Exportar', exact: true })).toHaveCount(0);
    expect(api.calls.some(url => url.pathname.includes('medical-profiles'))).toBe(false);
});

test('publication export-only exposes exports without loading the administrative inventory', async ({ page, api }) => {
    await grant(page, ['PUBLICATIONS_EXPORT']);
    await page.goto('/admin/publications');
    await expect(page.getByRole('button', { name: 'Exportar eventos', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Criar publicação', exact: true })).toHaveCount(0);
    expect(api.calls.some(url => /^\/admin\/(events|notices|services)/.test(url.pathname))).toBe(false);
});

test('membership alone never exposes administrative publication links', async ({ page }) => {
    await grant(page, []);
    await page.goto('/feed');
    await expect(page.getByRole('link', { name: 'Ver publicação completa: Aviso do clube', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /Criar (publicação|evento|aviso)/ })).toHaveCount(0);
    await expect(page.getByRole('link', { name: /^Editar:/ })).toHaveCount(0);
});
