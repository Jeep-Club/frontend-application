import http from 'node:http';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { expect } from '@playwright/test';
import { localApi, fakeCpf } from './local-api.mjs';

/** Real local API behind a fault-injection proxy; every other request is forwarded. */
export async function startUserActions() {
    const local = await localApi();
    const state = { ...local, failure: undefined, calls: [], baseURL: '' };
    state.fail = failure => { state.failure = failure; };
    state.clear = () => { state.failure = undefined; state.calls = []; };
    state.refreshAdmin = async () => { Object.assign(local.admin, await local.api('authentication/login', { method: 'POST', body: local.adminCredentials })); };
    state.member = async () => {
        const cpf = fakeCpf(), name = `E2E UI ${Date.now()} ${cpf.slice(0, 4)}`;
        const created = await local.api('identity/admin/users', { method: 'POST', token: local.admin.accessToken,
            body: { name, cpf, activationMethod: 'TEMPORARY_PASSWORD' } });
        const challenge = await local.api('authentication/login', { method: 'POST', body: { cpf, senha: created.temporaryPassword } });
        const password = `E2eUi!${Date.now()}a`;
        const session = await local.api('authentication/login/password-change', { method: 'POST', body: { passwordChangeToken: challenge.passwordChangeToken, newPassword: password } });
        return { name, cpf, password, session, userId: created.userId };
    };
    state.proxy = http.createServer(async (req, res) => {
        try {
            const chunks = []; for await (const chunk of req) chunks.push(chunk);
            state.calls.push({ method: req.method, path: req.url });
            const failure = state.failure;
            if (failure && (!failure.method || req.method === failure.method) && (!failure.path || new URL(req.url, 'http://localhost').pathname === failure.path)) {
                if (failure.network) { req.socket.destroy(); return; }
                res.writeHead(failure.status, { 'Content-Type': 'application/problem+json' });
                res.end(JSON.stringify({ status: failure.status, code: failure.status === 403 ? 'ACCESS_DENIED' : 'E2E_CONTROLLED_ERROR', detail: failure.detail ?? 'Não foi possível concluir a operação. Tente novamente.' }));
                return;
            }
            const response = await fetch(`${local.baseURL}${req.url}`, { method: req.method,
                headers: { ...req.headers, host: new URL(local.baseURL).host },
                ...(['GET', 'HEAD'].includes(req.method) ? {} : { body: Buffer.concat(chunks) }) });
            res.writeHead(response.status, { 'Content-Type': response.headers.get('content-type') || 'application/octet-stream' });
            res.end(Buffer.from(await response.arrayBuffer()));
        } catch { res.writeHead(502, { 'Content-Type': 'application/problem+json' }); res.end(JSON.stringify({ status: 502, code: 'E2E_PROXY_FAILURE', detail: 'Falha de conexão com o serviço.' })); }
    });
    state.proxy.listen(0, '127.0.0.1'); await once(state.proxy, 'listening');
    const reserve = http.createServer(); reserve.listen(0, '127.0.0.1'); await once(reserve, 'listening');
    const port = reserve.address().port; await new Promise(resolve => reserve.close(resolve));
    state.baseURL = `http://127.0.0.1:${port}`;
    state.next = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-H', '127.0.0.1', '-p', String(port)], {
        env: { ...process.env, API_URL: `http://127.0.0.1:${state.proxy.address().port}`, API_FRONTEND_KEY: 'e2e-local-ui', ACCESS: 'e2e-local-ui-signing-secret-only' },
        windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
    });
    let logs = ''; state.next.stdout.on('data', chunk => { logs += chunk; }); state.next.stderr.on('data', chunk => { logs += chunk; });
    await expect.poll(async () => { if (state.next.exitCode !== null) throw new Error(logs); try { return (await fetch(`${state.baseURL}/login`)).status; } catch { return 0; } }, { timeout: 60000 }).toBe(200);
    return state;
}

export async function stopUserActions(state) {
    if (!state) return;
    if (state.next && state.next.exitCode === null) { const stopped = once(state.next, 'exit'); state.next.kill(); await stopped; }
    if (state.proxy) { state.proxy.closeAllConnections(); await new Promise(resolve => state.proxy.close(resolve)); }
}

export async function loginUser(page, state, credentials = state.adminCredentials) {
    await page.addInitScript(() => { for (const key of ['tour_completed_admin', 'tour_completed_profile', 'tour_completed_member', 'tour_completed_roles', 'tour_completed_users']) localStorage.setItem(key, 'true'); });
    await page.goto(`${state.baseURL}/login`);
    await page.locator('input[name="cpf"]').fill(credentials.cpf);
    await page.locator('input[name="senha"]').fill(credentials.password ?? credentials.senha);
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await expect(page).toHaveURL(/\/feed$/);
}

export const userAction = (screen, action, error, response, source, exportName) => ({ annotation: { type: 'user-action', description: JSON.stringify({ screen, action, error, response, source: `/src/server/actions/${source}.ts`, exportName }) } });
