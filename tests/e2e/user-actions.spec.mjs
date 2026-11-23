import { test, expect } from '@playwright/test';
import { startUserActions, stopUserActions, loginUser, userAction } from './user-actions-harness.mjs';
import { fakeCpf } from './local-api.mjs';

test.use({ channel: process.env.E2E_BROWSER_CHANNEL || 'chrome' });
let app;
test.beforeAll(async () => { test.setTimeout(120000); app = await startUserActions(); });
test.afterAll(async () => { await stopUserActions(app); });
test.beforeEach(async () => { app.clear(); await app.refreshAdmin(); });
const errors = [
    { key: 'sucesso', error: 'Sem erro' },
    { key: '400', status: 400, error: 'Dados inválidos (400)' },
    { key: '403', status: 403, error: 'Sem permissão (403)' },
    { key: 'rede', network: true, error: 'Falha de rede' },
];
const failureMessage = 'Não foi possível concluir esta ação de teste.';
const toast = page => page.locator('[role="status"]');
async function expectFailure(page, scenario) {
    // Reads retain TanStack Query's default retries; wait for the terminal UI error.
    await expect(toast(page).filter({ hasText: scenario.network ? /conectar ao servidor|Verifique sua internet/i : failureMessage })).toBeVisible({ timeout: 15000 });
    expect((await page.context().cookies()).some(cookie => cookie.name === 'AuthAccessToken' && cookie.value)).toBe(true);
}

for (const scenario of errors) {
    test(`UI login: ${scenario.key}`, userAction('/login', 'Entrar na conta', scenario.error,
        scenario.key === 'sucesso' ? 'Abre o feed com sessão autenticada.' : 'Exibe aviso de erro e mantém o formulário de login.', 'auth/login', 'default'), async ({ page }) => {
        const member = await app.member();
        if (scenario.key === 'sucesso') { await loginUser(page, app, member); return; }
        await page.goto(`${app.baseURL}/login`);
        await page.locator('input[name="cpf"]').fill(member.cpf);
        await page.locator('input[name="senha"]').fill(member.password);
        app.fail({ ...scenario, method: 'POST', path: '/authentication/login', detail: failureMessage });
        await page.getByRole('button', { name: 'Entrar', exact: true }).click();
        await expect(toast(page).filter({ hasText: scenario.network ? /conectar ao servidor|internet/i : failureMessage })).toBeVisible();
        await expect(page).toHaveURL(/\/login$/);
        await expect(page.locator('input[name="senha"]')).toHaveValue(member.password);
    });
}

test('UI login: credenciais inválidas', userAction('/login', 'Entrar na conta', 'CPF ou senha inválidos.', 'Exibe mensagem de credenciais inválidas e permanece no login.', 'auth/login', 'default'), async ({ page }) => {
    const member = await app.member();
    await page.goto(`${app.baseURL}/login`);
    await page.locator('input[name="cpf"]').fill(member.cpf);
    await page.locator('input[name="senha"]').fill('InvalidPassword123!');
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await expect(toast(page).filter({ hasText: /CPF|senha|credenciais/i })).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
});

for (const network of [false, true]) {
    test(`UI logout: ${network ? 'rede indisponível' : 'sucesso'}`, userAction('/feed', 'Sair da conta', network ? 'Falha de rede' : 'Sem erro', 'Encerra a sessão local e abre a página pública.', 'auth/logout', 'default'), async ({ page }) => {
        await loginUser(page, app);
        if (network) app.fail({ method: 'POST', path: '/authentication/logout', network: true });
        await page.getByRole('button', { name: 'Sair', exact: true }).click();
        await page.getByRole('alertdialog').getByRole('button', { name: 'Sair', exact: true }).click();
        await expect(page).toHaveURL(`${app.baseURL}/`);
        expect((await page.context().cookies()).some(cookie => cookie.name === 'AuthAccessToken' && cookie.value)).toBe(false);
    });
}

for (const operation of ['create', 'update', 'delete']) for (const scenario of errors) {
    const labels = { create: 'Cadastrar ferramenta', update: 'Editar ferramenta', delete: 'Excluir ferramenta' };
    test(`UI ferramenta ${operation}: ${scenario.key}`, userAction('/profile — ferramentas', labels[operation], scenario.error,
        scenario.key === 'sucesso' ? 'Exibe confirmação e atualiza a lista de ferramentas.' : 'Exibe aviso de erro, mantém o formulário ou confirmação e permite tentar novamente.', `tools/${operation}`, `${operation}ToolAction`), async ({ page }) => {
        const member = await app.member();
        const token = member.session.accessToken;
        const tool = operation === 'create' ? null : await app.api('tools', { method: 'POST', token, body: { name: `Ferramenta UI ${Date.now()}`, description: 'Descrição sintética.' } });
        await loginUser(page, app, member);
        await page.goto(`${app.baseURL}/profile`);
        await page.locator('#tour-profile-tab-tools').click();
        await expect(page.getByRole('heading', { name: 'Minhas ferramentas', exact: true })).toBeVisible();
        if (operation === 'create') await page.getByRole('button', { name: 'Incluir Ferramenta', exact: true }).click();
        else await page.getByRole('button', { name: `${operation === 'update' ? 'Editar' : 'Excluir'} ${tool.name}`, exact: true }).click();
        const dialog = page.locator('[data-modal-content]').filter({ has: page.getByRole('heading', { name: /ferramenta/i }) });
        const name = `Ferramenta alterada ${Date.now()}`;
        if (operation !== 'delete') {
            await dialog.getByLabel(/^Nome/).fill(name);
            await dialog.getByLabel('Descrição', { exact: true }).fill('Rascunho preservado.');
        }
        if (scenario.key !== 'sucesso') app.fail({ ...scenario, method: { create: 'POST', update: 'PUT', delete: 'DELETE' }[operation], path: `/tools${tool ? `/${tool.id}` : ''}`, detail: failureMessage });
        await dialog.getByRole('button', { name: { create: 'Cadastrar ferramenta', update: 'Salvar alterações', delete: 'Excluir' }[operation], exact: true }).click();
        if (scenario.key === 'sucesso') {
            await expect(toast(page).filter({ hasText: { create: 'Ferramenta cadastrada com sucesso!', update: 'Ferramenta atualizada com sucesso!', delete: 'Ferramenta excluída com sucesso!' }[operation] })).toBeVisible();
            await expect(dialog).toHaveCount(0);
            if (operation !== 'delete') await expect(page.getByRole('button', { name: `Editar ${name}`, exact: true })).toBeVisible();
            else await expect(page.getByRole('button', { name: `Excluir ${tool.name}`, exact: true })).toHaveCount(0);
        } else {
            await expectFailure(page, scenario);
            await expect(dialog).toBeVisible();
            await expect(dialog.getByRole('button', { name: { create: 'Cadastrar ferramenta', update: 'Salvar alterações', delete: 'Excluir' }[operation], exact: true })).toBeEnabled();
            if (operation !== 'delete') { await expect(dialog.getByLabel(/^Nome/)).toHaveValue(name); await expect(dialog.getByLabel('Descrição', { exact: true })).toHaveValue('Rascunho preservado.'); }
        }
    });
}

for (const operation of ['create', 'update', 'delete']) for (const scenario of errors) {
    test(`UI cargo ${operation}: ${scenario.key}`, userAction('/admin/roles-permissoes', { create: 'Criar cargo', update: 'Editar cargo', delete: 'Excluir cargo' }[operation], scenario.error,
        scenario.key === 'sucesso' ? 'Exibe confirmação e atualiza a lista de cargos.' : 'Exibe aviso de erro e mantém os dados para nova tentativa.', `authorization/${operation}-role`, `${operation}RoleAction`), async ({ page }) => {
        const role = operation === 'create' ? null : await app.api('authorization/roles', { method: 'POST', token: app.admin.accessToken, body: { name: `Cargo UI ${Date.now()}`, description: 'Descrição sintética.' } });
        await loginUser(page, app);
        await page.goto(`${app.baseURL}/admin/roles-permissoes`);
        if (operation === 'create') await page.getByRole('button', { name: 'Criar cargo', exact: true }).click();
        else {
            await page.getByRole('searchbox', { name: 'Buscar cargos', exact: true }).fill(role.name);
            const card = page.getByRole('article').filter({ has: page.getByRole('heading', { name: role.name, exact: true }) });
            await card.getByRole('button', { name: operation === 'update' ? 'Editar' : 'Excluir', exact: true }).click();
        }
        const dialog = page.locator('[data-modal-content]').filter({ has: page.getByRole('heading', { name: /cargo/i }) }), name = `Cargo editado ${Date.now()}`;
        if (operation !== 'delete') { await dialog.getByLabel('Nome do cargo').fill(name); await dialog.getByLabel('Descrição', { exact: true }).fill('Rascunho do cargo.'); }
        if (scenario.key !== 'sucesso') app.fail({ ...scenario, method: { create: 'POST', update: 'PUT', delete: 'DELETE' }[operation], path: `/authorization/roles${role ? `/${role.id}` : ''}`, detail: failureMessage });
        await dialog.getByRole('button', { name: { create: 'Criar cargo', update: 'Salvar alterações', delete: 'Excluir' }[operation], exact: true }).click();
        if (scenario.key === 'sucesso') { await expect(toast(page).filter({ hasText: { create: 'Cargo criado com sucesso!', update: 'Cargo atualizado com sucesso!', delete: 'Cargo arquivado com sucesso!' }[operation] })).toBeVisible(); await expect(dialog).toHaveCount(0); }
        else { await expectFailure(page, scenario); await expect(dialog).toBeVisible(); await expect(dialog.getByRole('button', { name: { create: 'Criar cargo', update: 'Salvar alterações', delete: 'Excluir' }[operation], exact: true })).toBeEnabled(); if (operation !== 'delete') await expect(dialog.getByLabel('Nome do cargo')).toHaveValue(name); }
    });
}

for (const scenario of errors) {
    test(`UI cadastro de usuário: ${scenario.key}`, userAction('/admin/users/new', 'Cadastrar usuário com senha provisória', scenario.error,
        scenario.key === 'sucesso' ? 'Exibe a confirmação e a senha provisória do usuário criado.' : 'Exibe aviso de erro e preserva os dados do cadastro.', 'admin/users/create-first-access', 'createFirstAccessUserAction'), async ({ page }) => {
        await loginUser(page, app);
        await page.goto(`${app.baseURL}/admin/users/new`);
        const name = `Cadastro UI ${Date.now()}`, cpf = fakeCpf();
        await page.getByLabel('Nome completo').fill(name);
        await page.getByLabel(/^CPF/).fill(cpf);
        await page.getByLabel('Como o usuário vai ativar a conta').selectOption('TEMPORARY_PASSWORD');
        if (scenario.key !== 'sucesso') app.fail({ ...scenario, method: 'POST', path: '/identity/admin/users', detail: failureMessage });
        await page.getByRole('button', { name: 'Criar usuário', exact: true }).click();
        if (scenario.key === 'sucesso') { await expect(page.getByRole('heading', { name: 'Usuário criado', exact: true })).toBeVisible(); await expect(page.getByRole('button', { name: 'Copiar senha provisória', exact: true })).toBeVisible(); }
        else { await expectFailure(page, scenario); await expect(page.getByLabel('Nome completo')).toHaveValue(name); await expect(page.getByLabel(/^CPF/)).toHaveValue(/\d{3}\.\d{3}\.\d{3}-\d{2}/); }
    });
}

for (const scenario of errors) {
    test(`UI edição de usuário: ${scenario.key}`, userAction('/admin/users/[id]', 'Editar dados básicos do usuário', scenario.error,
        scenario.key === 'sucesso' ? 'Exibe confirmação e os dados básicos atualizados.' : 'Exibe aviso de erro e preserva os dados editados para nova tentativa.', 'admin/users/update', 'updateAdminUserAction'), async ({ page }) => {
        const member = await app.member();
        await loginUser(page, app);
        await page.goto(`${app.baseURL}/admin/users/${member.userId}`);
        const section = page.getByRole('region', { name: 'Dados cadastrais básicos', exact: true });
        await section.getByRole('button', { name: 'Editar dados básicos', exact: true }).click();
        const name = `Nome editado UI ${Date.now()}`;
        await section.getByLabel(/^Nome completo/).fill(name);
        if (scenario.key !== 'sucesso') app.fail({ ...scenario, method: 'PATCH', path: `/identity/admin/users/${member.userId}`, detail: failureMessage });
        await section.getByRole('button', { name: 'Salvar alterações', exact: true }).click();
        if (scenario.key === 'sucesso') {
            await expect(toast(page).filter({ hasText: 'Dados básicos do usuário atualizados com sucesso!' })).toBeVisible();
            await expect(section.getByRole('button', { name: 'Editar dados básicos', exact: true })).toBeVisible();
        } else { await expectFailure(page, scenario); await expect(section.getByLabel(/^Nome completo/)).toHaveValue(name); }
    });
}

for (const kind of ['tool', 'role']) for (const scenario of [...errors, { key: '404', status: 404, error: 'Recurso não encontrado (404)' }]) {
    test(`UI consulta ${kind}: ${scenario.key}`, userAction(kind === 'tool' ? '/profile — ferramentas' : '/admin/roles-permissoes', kind === 'tool' ? 'Visualizar ferramenta' : 'Visualizar cargo', scenario.error,
        scenario.key === 'sucesso' ? 'Exibe os detalhes do registro selecionado.' : 'Exibe aviso de erro e não revela os detalhes do registro.', kind === 'tool' ? 'tools/detail' : 'authorization/get-role', kind === 'tool' ? 'getToolDetailAction' : 'getRoleAction'), async ({ page }) => {
        const member = kind === 'tool' ? await app.member() : undefined;
        const name = `Consulta UI ${Date.now()}`, description = `Descrição privada ${Date.now()}`;
        const route = kind === 'tool' ? 'tools' : 'authorization/roles';
        const record = await app.api(route, { method: 'POST', token: member?.session.accessToken ?? app.admin.accessToken, body: { name, description } });
        await loginUser(page, app, member ?? app.adminCredentials);
        await page.goto(`${app.baseURL}${kind === 'tool' ? '/profile' : '/admin/roles-permissoes'}`);
        if (kind === 'tool') await page.locator('#tour-profile-tab-tools').click();
        else await page.getByRole('searchbox', { name: 'Buscar cargos', exact: true }).fill(name);
        if (scenario.key !== 'sucesso') app.fail({ ...scenario, method: 'GET', path: `/${route}/${record.id}`, detail: failureMessage });
        if (kind === 'tool') await page.getByRole('button', { name: `Visualizar ${name}`, exact: true }).click();
        else await page.getByRole('article').filter({ has: page.getByRole('heading', { name, exact: true }) }).getByRole('button', { name: 'Visualizar', exact: true }).click();
        const dialog = page.locator('[data-modal-content]');
        if (scenario.key === 'sucesso') await expect(dialog.getByText(description, { exact: true })).toBeVisible();
        else { await expectFailure(page, scenario); await expect(dialog.getByText(description, { exact: true })).toHaveCount(0); }
    });
}

for (const scenario of errors) {
    test(`UI recuperação de senha: ${scenario.key}`, userAction('/forgot-password', 'Solicitar recuperação de senha', scenario.error,
        scenario.key === 'sucesso' ? 'Exibe a confirmação de solicitação enviada.' : 'Exibe aviso de erro e permite enviar novamente sem apagar o CPF.', 'auth/forgot-password', 'default'), async ({ page }) => {
        const member = await app.member();
        await page.goto(`${app.baseURL}/forgot-password`);
        await page.getByLabel(/^CPF/).fill(member.cpf);
        if (scenario.key !== 'sucesso') app.fail({ ...scenario, method: 'POST', path: '/authentication/password-recovery/requests', detail: failureMessage });
        await page.getByRole('button', { name: 'Enviar', exact: true }).click();
        if (scenario.key === 'sucesso') await expect(page.getByRole('heading', { name: 'Solicitação enviada!', exact: true })).toBeVisible();
        else {
            await expect(toast(page).filter({ hasText: scenario.network ? /conectar ao servidor|internet/i : failureMessage })).toBeVisible();
            await expect(page.getByLabel(/^CPF/)).toHaveValue(/\d{3}\.\d{3}\.\d{3}-\d{2}/);
            await expect(page.getByRole('button', { name: 'Enviar', exact: true })).toBeEnabled();
        }
    });
}

for (const scenario of errors) {
    test(`UI exclusão de usuário pendente: ${scenario.key}`, userAction('/admin/users/[id] — acesso', 'Excluir cadastro pendente', scenario.error,
        scenario.key === 'sucesso' ? 'Confirma a exclusão definitiva e retorna à lista de usuários.' : 'Exibe aviso de erro, mantém os detalhes do usuário e permite confirmar uma nova tentativa.', 'admin/users/patchStatus', 'deleteAdminUserAction'), async ({ page }) => {
        const account = await app.api('identity/admin/users', { method: 'POST', token: app.admin.accessToken, body: { name: `Excluir UI ${Date.now()}`, cpf: fakeCpf(), activationMethod: 'TEMPORARY_PASSWORD' } });
        await loginUser(page, app);
        await page.goto(`${app.baseURL}/admin/users/${account.userId}`);
        await page.getByRole('navigation', { name: 'Informações do usuário' }).getByRole('button', { name: 'Acesso', exact: true }).click();
        await page.getByRole('button', { name: 'Excluir cadastro pendente', exact: true }).click();
        if (scenario.key !== 'sucesso') app.fail({ ...scenario, method: 'DELETE', path: `/identity/admin/users/${account.userId}`, detail: failureMessage });
        await page.getByRole('button', { name: 'Confirmar exclusão', exact: true }).click();
        if (scenario.key === 'sucesso') { await expect(toast(page).filter({ hasText: 'Cadastro pendente excluído definitivamente.' })).toBeVisible(); await expect(page).toHaveURL(/\/admin\/users$/); }
        else { await expectFailure(page, scenario); await expect(page).toHaveURL(new RegExp(`/admin/users/${account.userId}$`)); await expect(page.getByRole('button', { name: 'Excluir cadastro pendente', exact: true })).toBeEnabled(); }
    });
}

