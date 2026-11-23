import { test, expect } from '@playwright/test';
import http from 'node:http';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { localApi, fakeCpf } from './local-api.mjs';


const require = createRequire(import.meta.url);
const { load } = require('./schema-runtime.cjs');
const schemas = load('membership/application');
// Bearer invitations are held in memory only, never in traces or reports.
test.use({ channel: process.env.E2E_BROWSER_CHANNEL || 'chrome', trace: 'off' });
let local, proxy, next, baseURL, fault;
const links = new Map();
const calls = [];
const applications = [];
const listen = async server => {
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    return `http://127.0.0.1:${server.address().port}`;
};
const statusOf = async id => (await local.api(`admin/membership-applications/${id}`, { token: local.admin.accessToken })).status;

async function loginUser(page, app, credentials = local.adminCredentials) {
    await page.addInitScript(() => {
        for (const key of ['tour_completed_admin', 'tour_completed_profile', 'tour_completed_member', 'tour_completed_roles']) localStorage.setItem(key, 'true');
    });
    await page.goto(`${app.baseURL}/login`);
    await page.getByRole('button', { name: 'Mostrar senha', exact: true }).click();
    await expect(page.locator('input[name="senha"]')).toHaveAttribute('type', 'text');
    await page.locator('input[name="cpf"]').fill(credentials.cpf);
    await page.locator('input[name="senha"]').fill(credentials.password ?? credentials.senha);
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await expect(page).toHaveURL(/\/feed$/, { timeout: 30000 });
}

async function application() {
    const cpf = fakeCpf();
    const name = `E2E Convite ${Date.now()} ${cpf.slice(0, 4)}`;
    const response = await local.request('membership-applications', { method: 'POST', body: {
        name, cpf, email: `membership-${cpf}@example.invalid`, phoneNumber: '11999998888', message: 'Teste local de ativação por convite.',
    } });
    expect(response.status).toBe(201);
    expect(schemas.membershipApplicationSubmissionSchema.safeParse(response.data).success).toBe(true);
    const applicant = { id: response.data.id, name, cpf };
    applications.push(applicant.id);
    return applicant;
}

async function approve(id) {
    const response = await local.request(`admin/membership-applications/${id}/approve/access-link`, { method: 'POST', token: local.admin.accessToken });
    expect(response.status).toBe(200);
    expect(schemas.accessLinkApprovalSchema.safeParse(response.data).success).toBe(true);
    return new URL(response.data.activationLink).searchParams.get('token');
}

test.beforeAll(async () => {
    test.setTimeout(180000);
    local = await localApi();
    proxy = http.createServer(async (req, res) => {
        try {
            const url = new URL(req.url, local.baseURL);
            const chunks = [];
            for await (const chunk of req) chunks.push(chunk);
            if (fault && url.pathname === '/membership-applications/activate') {
                res.writeHead(fault.status, { 'Content-Type': 'application/problem+json' });
                res.end(JSON.stringify({ ...fault, detail: 'Convite expirado.' }));
                return;
            }
            const response = await fetch(`${local.baseURL}${req.url}`, { method: req.method,
                headers: { ...req.headers, host: new URL(local.baseURL).host },
                ...(['GET', 'HEAD'].includes(req.method) ? {} : { body: Buffer.concat(chunks) }) });
            const body = await response.text();
            calls.push({ method: req.method, path: url.pathname, status: response.status });
            const approval = url.pathname.match(/^\/admin\/membership-applications\/(\d+)\/approve\/access-link$/);
            if (approval && response.ok) links.set(Number(approval[1]), new URL(JSON.parse(body).activationLink).searchParams.get('token'));
            res.writeHead(response.status, { 'Content-Type': response.headers.get('content-type') || 'application/json' });
            res.end(body);
        } catch {
            res.writeHead(502, { 'Content-Type': 'application/problem+json' });
            res.end(JSON.stringify({ status: 502, code: 'LOCAL_PROXY_FAILURE', detail: 'Falha no serviço local.' }));
        }
    });
    const apiURL = await listen(proxy);
    const reservation = http.createServer();
    baseURL = await listen(reservation);
    await new Promise(resolve => reservation.close(resolve));
    next = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '-H', '127.0.0.1', '-p', new URL(baseURL).port], {
        windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, API_URL: apiURL, APP_URL: baseURL, PLAYWRIGHT_APP_URL: baseURL,
            API_FRONTEND_KEY: 'local-membership-test', ACCESS: 'local-membership-signing-secret', NODE_SECURE: 'HTTP',
            JEEP_PLAYWRIGHT: '1', JEEP_PLAYWRIGHT_ID: 'membership-integration' },
    });
    // Drain output without persisting URLs containing invitations.
    next.stdout.on('data', () => {});
    next.stderr.on('data', () => {});
    await expect.poll(async () => {
        if (next.exitCode !== null) throw new Error('O frontend local não iniciou.');
        try { return (await fetch(`${baseURL}/login`)).status; } catch { return 0; }
    }, { timeout: 120000 }).toBe(200);
});

test.afterAll(async () => {
    fault = undefined;
    // Reverse only this run's applications that are still awaiting first access.
    for (const id of applications) {
        if (['PENDING', 'APPROVED'].includes(await statusOf(id))) await local.api(`admin/membership-applications/${id}/reject`, {
            method: 'POST', token: local.admin.accessToken, body: { reason: 'Encerramento do teste local de convite.' },
        });
    }
    links.clear();
    if (next && next.exitCode === null) { const stopped = once(next, 'exit'); next.kill(); await stopped; }
    if (proxy) { proxy.closeAllConnections(); await new Promise(resolve => proxy.close(resolve)); }
});

test('convite real: valida sem consumir, cria senha, conclui e permite login normal', async ({ page }) => {
    const applicant = await application();
    const token = await approve(applicant.id);
    const validationRoute = `membership-applications/activate?${new URLSearchParams({ token })}`;
    for (let attempt = 0; attempt < 2; attempt++) expect((await local.request(validationRoute)).status).toBe(204);
    expect(await statusOf(applicant.id)).toBe('APPROVED');
    for (const length of [7, 73]) expect((await local.request('membership-applications/activate', {
        method: 'POST', body: { token, newPassword: 'a'.repeat(length) },
    })).status).toBe(400);
    expect(await statusOf(applicant.id)).toBe('APPROVED');
    await page.goto(`${baseURL}/membership/activate?${new URLSearchParams({ token })}`);
    await expect(page.getByLabel(/^Nova senha/)).toBeVisible({ timeout: 15000 });
    await expect(page).toHaveURL(`${baseURL}/membership/activate`);
    const password = `Membership!${Date.now()}a`;
    await page.getByLabel(/^Nova senha/).fill(password);
    await page.getByLabel(/^Confirmar senha/).fill('OutraSenha123!');
    await page.getByRole('button', { name: 'Ativar associação', exact: true }).click();
    await expect(page.getByText('As senhas não coincidem', { exact: true })).toBeVisible();
    expect(await statusOf(applicant.id)).toBe('APPROVED');
    await page.getByLabel(/^Confirmar senha/).fill(password);
    await page.getByRole('button', { name: 'Ativar associação', exact: true }).click();
    await expect(page).toHaveURL(`${baseURL}/login`);
    expect(await statusOf(applicant.id)).toBe('COMPLETED');
    expect(calls.some(call => call.path === '/membership-applications/activate' && call.method === 'POST' && call.status === 204)).toBe(true);
    await page.goto(`${baseURL}/membership/activate?${new URLSearchParams({ token })}`);
    await expect(page.getByRole('main').getByRole('alert')).toContainText('já foi utilizado');
    await expect(page.getByLabel(/^Nova senha/)).toHaveCount(0);
    await loginUser(page, { ...local, baseURL }, { cpf: applicant.cpf, password });
});

test('admin real: aprova pelo userId, reenvia com 204 e mantém APPROVED', async ({ page }) => {
    const applicant = await application();
    await page.addInitScript(() => {
        localStorage.setItem('tour_completed_admin_applications', 'true');
        localStorage.setItem('tour_completed_admin_users', 'true');
    });
    await loginUser(page, { ...local, baseURL });
    await page.goto(`${baseURL}/admin/users?tab=applications`);
    const card = page.getByRole('article').filter({ hasText: applicant.name });
    await card.getByRole('button', { name: 'Aprovar e enviar convite', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Sim, confirmar' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Envio do convite por e-mail solicitado.' })).toBeVisible();
    expect(await statusOf(applicant.id)).toBe('APPROVED');
    expect(links.has(applicant.id)).toBe(true);
    const originalToken = links.get(applicant.id);
    await page.getByRole('combobox', { name: /^Status/ }).selectOption('APPROVED');
    await expect(card).toBeVisible();
    await page.reload();
    const status = page.getByRole('combobox', { name: /^Status/ });
    await status.selectOption('APPROVED');
    await card.getByRole('button', { name: /Reenviar convite/ }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Reenvio do convite solicitado.' })).toBeVisible();
    expect(calls.some(call => call.path === `/admin/membership-applications/${applicant.id}/activation-link/resend` && call.method === 'POST' && call.status === 204)).toBe(true);
    expect(await statusOf(applicant.id)).toBe('APPROVED');
    expect((await local.request(`membership-applications/activate?${new URLSearchParams({ token: originalToken })}`)).status).toBe(409);
    await expect(page.getByText(/token=/)).toHaveCount(0);
    const detail = await local.api(`admin/membership-applications/${applicant.id}`, { token: local.admin.accessToken });
    expect(schemas.membershipApplicationSchema.safeParse(detail).success).toBe(true);
    expect(detail).not.toHaveProperty('userId');
});

test('convite invalidado por reenvio após abrir o formulário não conclui o primeiro acesso', async ({ page }) => {
    const applicant = await application();
    const token = await approve(applicant.id);
    await page.goto(`${baseURL}/membership/activate?${new URLSearchParams({ token })}`);
    await expect(page.getByLabel(/^Nova senha/)).toBeVisible();
    expect((await local.request(`admin/membership-applications/${applicant.id}/activation-link/resend`, {
        method: 'POST', token: local.admin.accessToken,
    })).status).toBe(204);
    await page.getByLabel(/^Nova senha/).fill('Membership123!');
    await page.getByLabel(/^Confirmar senha/).fill('Membership123!');
    await page.getByRole('button', { name: 'Ativar associação', exact: true }).click();
    await expect(page.getByRole('main').getByRole('alert')).toContainText('já foi utilizado');
    await expect(page.getByLabel(/^Nova senha/)).toHaveCount(0);
    expect(await statusOf(applicant.id)).toBe('APPROVED');
});

test('convite inválido real e resposta de expiração controlada ocultam a senha e orientam reenvio', async ({ page }) => {
    await page.goto(`${baseURL}/membership/activate?token=invalid-local-membership-token`);
    await expect(page.getByRole('main').getByRole('alert')).toContainText('inválido');
    await expect(page.getByLabel(/^Nova senha/)).toHaveCount(0);
    // Time-based expiry is injected at the HTTP boundary; other tests use the real API.
    fault = { status: 410, code: 'ACTIVATION_TOKEN_EXPIRED' };
    await page.goto(`${baseURL}/membership/activate?token=expired-local-fixture`);
    await expect(page.getByRole('main').getByRole('alert')).toContainText('expirou');
    await expect(page.getByRole('main').getByRole('alert')).toContainText('reenvio');
    await expect(page.getByLabel(/^Nova senha/)).toHaveCount(0);
    fault = undefined;
});


