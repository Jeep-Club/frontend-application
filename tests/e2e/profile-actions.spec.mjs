import { test, expect } from '@playwright/test';
import http from 'node:http';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { localApi, fakeCpf } from './local-api.mjs';

test.use({ channel: process.env.E2E_BROWSER_CHANNEL || 'chrome' });
let local, member, proxy, next, baseURL, fault;
let requests = [];
const source = '/src/server/actions/dependents/index.ts';
const networkMessage = 'Não foi possível conectar ao servidor. Verifique sua internet e tente novamente.';
const faultCases = [
    { error: 'Dados inválidos (400)', status: 400, message: 'Não foi possível salvar os dados informados.' },
    { error: 'Sem permissão (403)', status: 403, message: 'Você não tem permissão para esta operação.' },
    { error: 'Conflito (409)', status: 409, message: 'Não foi possível concluir: o cadastro foi alterado.' },
    { error: 'Falha de rede', status: 0, message: networkMessage },
    { error: 'Serviço indisponível (503)', status: 503, message: 'Serviço temporariamente indisponível. Tente novamente.' },
];
const annotated = (action, exportName, error, response) => ({ annotation: { type: 'user-action', description: JSON.stringify({ screen: '/profile — dependentes', action, error, response, source, exportName }) } });
const listen = async server => { server.listen(0, '127.0.0.1'); await once(server, 'listening'); return `http://127.0.0.1:${server.address().port}`; };

test.beforeAll(async () => {
    test.setTimeout(120000);
    local = await localApi();
    const cpf = fakeCpf(), password = `Profile!${Date.now()}a`;
    const account = await local.api('identity/admin/users', { method: 'POST', token: local.admin.accessToken, body: { name: `E2E Perfil ${Date.now()}`, cpf, activationMethod: 'TEMPORARY_PASSWORD' } });
    const challenge = await local.api('authentication/login', { method: 'POST', body: { cpf, senha: account.temporaryPassword } });
    const session = await local.api('authentication/login/password-change', { method: 'POST', body: { passwordChangeToken: challenge.passwordChangeToken, newPassword: password } });
    member = { cpf, password, session };
    proxy = http.createServer(async (req, res) => {
        try {
            const chunks = []; for await (const chunk of req) chunks.push(chunk);
            requests.push({ method: req.method, path: req.url });
            if (fault && req.method === fault.method && new RegExp(fault.path).test(req.url)) {
                if (!fault.status) { req.socket.destroy(); return; }
                res.writeHead(fault.status, { 'Content-Type': 'application/problem+json' });
                res.end(JSON.stringify({ status: fault.status, code: 'E2E_CONTROLLED_FAILURE', detail: fault.message })); return;
            }
            const response = await fetch(`${local.baseURL}${req.url}`, { method: req.method, headers: { ...req.headers, host: new URL(local.baseURL).host }, ...(['GET', 'HEAD'].includes(req.method) ? {} : { body: Buffer.concat(chunks) }) });
            res.writeHead(response.status, { 'Content-Type': response.headers.get('content-type') || 'application/json' });
            res.end(Buffer.from(await response.arrayBuffer()));
        } catch { res.writeHead(502, { 'Content-Type': 'application/problem+json' }); res.end(JSON.stringify({ status: 502, code: 'E2E_PROXY_FAILURE', detail: 'Falha no proxy local de testes.' })); }
    });
    const apiURL = await listen(proxy);
    const reservation = http.createServer(); baseURL = await listen(reservation); await new Promise(resolve => reservation.close(resolve));
    let logs = '';
    next = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-H', '127.0.0.1', '-p', new URL(baseURL).port], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, API_URL: apiURL, ACCESS: 'local-profile-actions-signing-secret', API_FRONTEND_KEY: 'local-profile-actions', NODE_SECURE: 'HTTP' } });
    next.stdout.on('data', chunk => { logs += chunk; }); next.stderr.on('data', chunk => { logs += chunk; });
    await expect.poll(async () => { if (next.exitCode !== null) throw new Error(logs); try { return (await fetch(`${baseURL}/login`)).status; } catch { return 0; } }, { timeout: 60000 }).toBe(200);
});

test.afterAll(async () => {
    if (next && next.exitCode === null) { const exited = once(next, 'exit'); next.kill(); await exited; }
    if (proxy) { proxy.closeAllConnections(); await new Promise(resolve => proxy.close(resolve)); }
});

test.beforeEach(async ({ page }) => {
    fault = undefined; requests = [];
    await page.addInitScript(() => { for (const key of ['tour_completed_admin', 'tour_completed_member', 'tour_completed_profile', 'tour_completed_member_dependents']) localStorage.setItem(key, 'true'); });
    await page.goto(`${baseURL}/login`);
    await page.locator('input[name="cpf"]').fill(member.cpf);
    await page.locator('input[name="senha"]').fill(member.password);
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await expect(page).toHaveURL(/\/feed$/);
    const currentToken = (await page.context().cookies()).find(cookie => cookie.name === 'AuthAccessToken')?.value;
    expect(currentToken).toBeTruthy(); member.session.accessToken = currentToken;
    await page.goto(`${baseURL}/profile`);
    await page.getByRole('button', { name: 'Dependentes', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Meus dependentes', exact: true })).toBeVisible();
});

async function seedDependent({ medical = true } = {}) {
    const dependent = await local.api('dependents', { method: 'POST', token: member.session.accessToken, body: { name: `Dependente E2E ${Date.now()}`, cpf: fakeCpf(), birthDate: '2010-05-12', relationshipType: 'CHILD', phoneNumber: '12999999999' } });
    if (medical) await local.api(`medical-profiles/dependents/${dependent.id}`, { method: 'PUT', token: member.session.accessToken, body: { bloodType: 'A_POSITIVE' } });
    return dependent;
}
async function rowFor(page, dependent) {
    await page.reload(); await page.getByRole('button', { name: 'Dependentes', exact: true }).click();
    // Each test only interacts with its own synthetic record, regardless of previous seeds.
    const row = page.locator('div').filter({ has: page.getByText(dependent.name, { exact: true }) }).filter({ has: page.getByRole('button', { name: 'Editar', exact: true }) }).last();
    if (!await row.isVisible()) {
        const nextPage = page.getByRole('button', { name: /Próxima página/ });
        while (!await row.isVisible() && await nextPage.isEnabled()) await nextPage.click();
    }
    await expect(row).toBeVisible(); return row;
}
async function fillDependent(dialog, name) {
    await dialog.getByLabel(/^Nome completo/).fill(name);
    const cpf = dialog.getByLabel(/^CPF/); if (await cpf.isEnabled()) await cpf.fill(fakeCpf());
    await dialog.getByLabel(/^Data de nascimento/).fill('2010-05-12');
    await dialog.getByRole('combobox', { name: /Parentesco/ }).click();
    await dialog.page().getByRole('option', { name: 'Filho(a)', exact: true }).click();
    await dialog.getByLabel(/^Telefone/).fill('12999999999');
    await dialog.getByRole('combobox', { name: /Tipo sanguíneo/ }).click();
    await dialog.page().getByRole('option', { name: 'A+', exact: true }).click();
    const consent = dialog.getByRole('checkbox', { name: /Tenho autorização/ });
    // The native input is sr-only; users activate its visible wrapping label.
    if (!await consent.isChecked()) await consent.locator('..').click();
    await expect(consent).toBeChecked();
}

test('PROFILE-DEPENDENT-CRUD cadastro, consulta e edição; histórico médico impede exclusão', { annotation: [
    ...[['Cadastrar dependente', 'createDependentAction'], ['Consultar dependentes', 'listDependentsAction'], ['Editar dependente', 'updateDependentAction'], ['Salvar perfil médico de dependente', 'saveDependentMedicalProfileAction'], ['Consultar perfil médico de dependente', 'getDependentMedicalProfileAction']].map(([action, exportName]) => annotated(action, exportName, 'Sem erro', 'Exibe os dados atualizados e confirma a operação na interface.').annotation),
    annotated('Excluir dependente com histórico médico', 'deleteDependentAction', 'Conflito (409)', 'Exibe aviso de erro e preserva o cadastro que possui histórico médico.').annotation,
] }, async ({ page }) => {
    const name = `Dependente cadastrado ${Date.now()}`;
    await page.getByRole('button', { name: 'Incluir dependente', exact: true }).click();
    await fillDependent(page.locator('[data-modal-content]'), name);
    await page.getByRole('button', { name: 'Salvar dependente', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Dependente cadastrado com sucesso!' })).toBeVisible();
    const dependent = (await local.api('dependents', { token: member.session.accessToken })).find(item => item.name === name);
    expect(dependent).toBeDefined();
    let row = await rowFor(page, dependent);
    await row.getByRole('button', { name: 'Visualizar', exact: true }).click();
    await expect(page.locator('[data-modal-content]')).toContainText(name);
    await page.keyboard.press('Escape');
    await row.getByRole('button', { name: 'Editar', exact: true }).click();
    await fillDependent(page.locator('[data-modal-content]'), `${name} atualizado`);
    await page.getByRole('button', { name: 'Salvar dependente', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Dependente atualizado com sucesso!' })).toBeVisible();
    row = await rowFor(page, { ...dependent, name: `${name} atualizado` });
    await row.getByRole('button', { name: 'Excluir', exact: true }).click();
    await page.locator('[data-modal-content]').getByRole('button', { name: 'Excluir', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Não foi possível concluir a solicitação.' })).toBeVisible();
    expect((await local.api('dependents', { token: member.session.accessToken })).some(item => item.id === dependent.id)).toBe(true);
});

test('PROFILE-DEPENDENT-DELETE exclusão permitida sem referências médicas ou de eventos', annotated('Excluir dependente sem histórico', 'deleteDependentAction', 'Sem erro', 'Exibe confirmação e remove o dependente da lista.'), async ({ page }) => {
    const dependent = await seedDependent({ medical: false });
    const row = await rowFor(page, dependent);
    await row.getByRole('button', { name: 'Excluir', exact: true }).click();
    await page.locator('[data-modal-content]').getByRole('button', { name: 'Excluir', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Dependente excluído com sucesso!' })).toBeVisible();
    expect((await local.api('dependents', { token: member.session.accessToken })).some(item => item.id === dependent.id)).toBe(false);
});

for (const operation of ['create', 'update', 'delete']) for (const failure of faultCases) {
    const action = { create: 'Cadastrar dependente', update: 'Editar dependente', delete: 'Excluir dependente' }[operation];
    const exportName = { create: 'createDependentAction', update: 'updateDependentAction', delete: 'deleteDependentAction' }[operation];
    test(`PROFILE-DEPENDENT-${operation}-${failure.status} ${action}: ${failure.error}`, annotated(action, exportName, failure.error, 'Exibe toast de erro, mantém o formulário ou confirmação aberto e permite tentar novamente.'), async ({ page }) => {
        const name = `Rascunho dependente ${Date.now()}`;
        let dependent;
        if (operation === 'create') await page.getByRole('button', { name: 'Incluir dependente', exact: true }).click();
        else {
            dependent = await seedDependent();
            const row = await rowFor(page, dependent);
            await row.getByRole('button', { name: operation === 'delete' ? 'Excluir' : 'Editar', exact: true }).click();
        }
        const dialog = page.locator('[data-modal-content]');
        if (operation !== 'delete') await fillDependent(dialog, name);
        fault = { ...failure, method: { create: 'POST', update: 'PUT', delete: 'DELETE' }[operation], path: '^/dependents(?:/\\d+)?$' };
        await dialog.getByRole('button', { name: operation === 'delete' ? 'Excluir' : 'Salvar dependente', exact: true }).click();
        await expect(page.getByRole('status').filter({ hasText: failure.message })).toBeVisible();
        await expect(dialog).toBeVisible();
        if (operation !== 'delete') await expect(dialog.getByLabel(/^Nome completo/)).toHaveValue(name);
        await expect(dialog.getByRole('button', { name: operation === 'delete' ? 'Excluir' : 'Salvar dependente', exact: true })).toBeEnabled();
        const records = await local.api('dependents', { token: member.session.accessToken });
        if (operation === 'create') expect(records.some(item => item.name === name)).toBe(false);
        else expect(records.find(item => item.id === dependent.id)?.name).toBe(dependent.name);
    });
}

test('PROFILE-DEPENDENT-VALIDATION dados vazios bloqueiam cadastro sem enviar ao backend', annotated('Cadastrar dependente', 'createDependentAction', 'Formulário incompleto', 'Exibe validação dos campos e não envia o cadastro.'), async ({ page }) => {
    await page.getByRole('button', { name: 'Incluir dependente', exact: true }).click();
    const dialog = page.locator('[data-modal-content]');
    await dialog.getByRole('button', { name: 'Salvar dependente', exact: true }).click();
    await expect(dialog.getByText('Informe o nome completo', { exact: true })).toBeVisible();
    expect(requests.some(item => item.method === 'POST' && item.path === '/dependents')).toBe(false);
});
