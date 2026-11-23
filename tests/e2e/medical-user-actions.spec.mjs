import { test, expect } from '@playwright/test';
import { startUserActions, stopUserActions, loginUser, userAction } from './user-actions-harness.mjs';

// Each interaction runs in the production UI with synthetic records in the local backend.
test.use({ channel: process.env.E2E_BROWSER_CHANNEL || 'chrome' });
let app;
const cases = [
    { key: 'sucesso', error: 'Sem erro' },
    { key: '400', error: 'Dados inválidos (400)', status: 400 },
    { key: '403', error: 'Sem permissão (403)', status: 403 },
    { key: 'rede', error: 'Falha de rede', network: true },
];
const message = 'Não foi possível concluir a operação médica de teste.';
const status = page => page.locator('[role="status"]');
const fail = (scenario, method, path) => { if (scenario.key !== 'sucesso') app.fail({ ...scenario, method, path, detail: message }); };
const medicalData = (name = 'Contato sintético') => ({
    bloodType: 'A_POSITIVE', allergies: 'Alergia sintética', chronicConditions: 'Não se aplica',
    continuousMedications: 'Não se aplica', healthInsuranceProvider: 'Não se aplica',
    healthInsurancePlan: 'Não se aplica', healthInsuranceNumber: 'Não se aplica',
    emergencyContactName: name, emergencyContactPhone: '12999999999',
    emergencyContactRelationship: 'Familiar', observations: 'Não se aplica',
});

test.beforeAll(async () => { test.setTimeout(120000); app = await startUserActions(); });
test.afterAll(async () => { await stopUserActions(app); });
test.beforeEach(async () => { app.clear(); await app.refreshAdmin(); });

async function errorVisible(page, scenario) {
    await expect(status(page).filter({ hasText: scenario.network ? /conectar ao servidor|Verifique sua internet/i : message }).first()).toBeVisible({ timeout: 15000 });
    expect((await page.context().cookies()).some(cookie => cookie.name === 'AuthAccessToken' && cookie.value)).toBe(true);
}

async function profile(page, member, tab = 'personal') {
    await loginUser(page, app, member);
    await page.goto(`${app.baseURL}/profile`);
    if (tab !== 'personal') await page.locator(`#tour-profile-tab-${tab}`).click();
}

const personalModal = page => page.locator('[data-modal-content]').filter({ has: page.getByRole('heading', { name: 'Editar dados pessoais', exact: true }) });
const selfMedicalModal = page => page.locator('[data-modal-content]').filter({ has: page.getByRole('heading', { name: /^(Editar|Incluir) dados médicos$/ }) });

async function fillMedical(page, modal, contact) {
    await modal.getByRole('combobox', { name: /^Tipo sanguíneo/ }).click();
    await page.getByRole('option', { name: 'A+', exact: true }).click();
    await modal.getByRole('textbox', { name: 'Nome', exact: true }).fill(contact);
    await modal.getByRole('textbox', { name: 'Telefone', exact: true }).fill('12999999999');
    await modal.getByRole('textbox', { name: 'Parentesco', exact: true }).fill('Familiar');
}

for (const scenario of cases) {
    test(`UI meus dados pessoais: ${scenario.key}`, userAction('/profile — dados pessoais', 'Editar meus dados pessoais', scenario.error,
        scenario.key === 'sucesso' ? 'Exibe confirmação, atualiza os dados e permite remover os campos opcionais.' : 'Exibe aviso de erro e preserva o formulário editado.',
        'profile/update-personal-data', 'updatePersonalDataAction'), async ({ page }) => {
        const member = await app.member();
        await profile(page, member);
        await page.getByTitle('Editar dados pessoais', { exact: true }).click();
        const modal = personalModal(page);
        const name = `Dados pessoais UI ${Date.now()}`;
        await modal.getByLabel(/^Nome completo/).fill(name);
        await modal.getByRole('textbox', { name: 'E-mail', exact: true }).fill(`medical.ui.${Date.now()}@example.test`);
        await modal.getByRole('textbox', { name: 'RG', exact: true }).fill(member.cpf.slice(0, 9));
        await modal.getByRole('textbox', { name: 'Telefone', exact: true }).fill('12999999999');
        fail(scenario, 'PATCH', '/identity/me');
        await modal.getByRole('button', { name: 'Salvar alterações', exact: true }).click();
        if (scenario.key === 'sucesso') {
            await expect(status(page).filter({ hasText: 'Dados atualizados com sucesso!' })).toBeVisible();
            await expect(modal).toHaveCount(0);
            await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
            await page.getByTitle('Editar dados pessoais', { exact: true }).click();
            await expect(modal.getByLabel(/^Nome completo/)).toHaveValue(name);
            await modal.getByRole('textbox', { name: 'RG', exact: true }).fill('');
            await modal.getByRole('textbox', { name: 'Telefone', exact: true }).fill('');
            await modal.getByRole('button', { name: 'Salvar alterações', exact: true }).click();
            await expect(modal).toHaveCount(0);
            await page.getByTitle('Editar dados pessoais', { exact: true }).click();
            await expect(modal.getByRole('textbox', { name: 'RG', exact: true })).toHaveValue('');
            await expect(modal.getByRole('textbox', { name: 'Telefone', exact: true })).toHaveValue('');
        } else {
            await errorVisible(page, scenario);
            await expect(modal.getByLabel(/^Nome completo/)).toHaveValue(name);
            await expect(modal.getByRole('button', { name: 'Salvar alterações', exact: true })).toBeEnabled();
            expect((await app.api('identity/me', { token: member.session.accessToken })).name).toBe(member.name);
        }
    });
}

for (const scenario of cases) {
    test(`UI salvar meu perfil médico: ${scenario.key}`, userAction('/profile — dados médicos', 'Salvar meus dados médicos', scenario.error,
        scenario.key === 'sucesso' ? 'Atualiza o contato de emergência e permite remover a descrição de alergia.' : 'Exibe aviso de erro e mantém o contato digitado para nova tentativa.',
        'profile/medical-profile', 'saveMedicalProfileAction'), async ({ page }) => {
        const member = await app.member();
        await app.api('medical-profiles/me', { method: 'PUT', token: member.session.accessToken, body: medicalData() });
        await profile(page, member, 'medical');
        await page.getByRole('button', { name: 'Editar informações', exact: true }).click();
        const modal = selfMedicalModal(page);
        const contact = `Contato editado ${Date.now()}`;
        await fillMedical(page, modal, contact);
        fail(scenario, 'PUT', '/medical-profiles/me');
        await modal.getByRole('button', { name: 'Salvar alterações', exact: true }).click();
        if (scenario.key === 'sucesso') {
            await expect(status(page).filter({ hasText: 'Perfil médico atualizado com sucesso!' })).toBeVisible();
            await expect(modal).toHaveCount(0);
            await expect(page.getByText(contact, { exact: true })).toBeVisible();
            await page.getByRole('button', { name: 'Editar informações', exact: true }).click();
            await expect(modal.getByLabel('Quais alergias?', { exact: true })).toHaveValue('Alergia sintética');
            await modal.getByText('Possui alguma alergia?', { exact: true }).locator('..').getByRole('button', { name: 'Não', exact: true }).click();
            await expect(modal.getByLabel('Quais alergias?', { exact: true })).toHaveCount(0);
            await modal.getByRole('button', { name: 'Salvar alterações', exact: true }).click();
            await expect(modal).toHaveCount(0);
            await expect(page.getByText('Alergia sintética', { exact: true })).toHaveCount(0);
            await page.getByRole('button', { name: 'Editar informações', exact: true }).click();
            await expect(modal.getByLabel('Quais alergias?', { exact: true })).toHaveCount(0);
        } else {
            await errorVisible(page, scenario);
            await expect(modal.getByRole('textbox', { name: 'Nome', exact: true })).toHaveValue(contact);
            await expect(modal.getByRole('button', { name: 'Salvar alterações', exact: true })).toBeEnabled();
            expect((await app.api('medical-profiles/me', { token: member.session.accessToken })).emergencyContactName).toBe('Contato sintético');
        }
    });
}

for (const scenario of [...cases, { key: '404', status: 404, error: 'Perfil médico ainda não cadastrado (404)' }]) {
    test(`UI consultar meu perfil médico: ${scenario.key}`, userAction('/profile — dados médicos', 'Consultar meus dados médicos', scenario.error,
        scenario.key === 'sucesso' ? 'Exibe o contato médico do titular.' : scenario.key === '404' ? 'Exibe estado sem informações médicas e o botão de incluir.' : 'Exibe erro de consulta e permite tentar novamente sem revelar os dados.',
        'profile/medical-profile', 'getMedicalProfileAction'), async ({ page }) => {
        const member = await app.member();
        if (scenario.key !== '404') await app.api('medical-profiles/me', { method: 'PUT', token: member.session.accessToken, body: medicalData('Contato confidencial de teste') });
        await loginUser(page, app, member);
        // The personal tab preloads medical information as well, so inject before opening profile.
        if (!['sucesso', '404'].includes(scenario.key)) fail(scenario, 'GET', '/medical-profiles/me');
        await page.goto(`${app.baseURL}/profile`);
        await page.locator('#tour-profile-tab-medical').click();
        if (scenario.key === 'sucesso') await expect(page.getByText('Contato confidencial de teste', { exact: true })).toBeVisible();
        else if (scenario.key === '404') {
            await expect(page.getByText('Você ainda não cadastrou informações médicas', { exact: true })).toBeVisible();
            await expect(page.getByRole('button', { name: 'Incluir informações', exact: true })).toBeVisible();
        } else {
            await expect(page.getByText('Não foi possível carregar seu perfil médico.', { exact: true })).toBeVisible({ timeout: 15000 });
            await expect(page.getByText('Contato confidencial de teste', { exact: true })).toHaveCount(0);
            app.clear();
            await page.getByRole('button', { name: 'Tentar novamente', exact: true }).click();
            await expect(page.getByText('Contato confidencial de teste', { exact: true })).toBeVisible();
        }
    });
}

for (const operation of ['create', 'edit', 'delete']) for (const scenario of cases) {
    const deleting = operation === 'delete';
    const annotation = userAction('/admin/dados-medicos',
        { create: 'Cadastrar perfil médico', edit: 'Editar perfil médico', delete: 'Excluir perfil médico' }[operation], scenario.error,
        scenario.key === 'sucesso' ? deleting ? 'Confirma a exclusão e remove o perfil da lista.' : 'Confirma o salvamento e exibe os dados atualizados ao consultar o perfil.' : 'Exibe aviso de erro e mantém o formulário ou a confirmação para tentar novamente.',
        deleting ? 'admin/medical-profile/manage' : 'admin/medical-profile/put', deleting ? 'deleteMedicalProfileAction' : 'putMedicalProfileAction');
    if (!deleting) annotation.annotation.description = JSON.stringify({ ...JSON.parse(annotation.annotation.description), actionId: `putMedicalProfile:${operation}` });
    test(`UI perfil médico administrativo ${operation}: ${scenario.key}`, annotation, async ({ page }) => {
        const member = await app.member();
        const medical = operation === 'create' ? null : await app.api('medical-profiles/me', { method: 'PUT', token: member.session.accessToken, body: medicalData() });
        await loginUser(page, app);
        await page.goto(`${app.baseURL}/admin/dados-medicos`);
        await expect(page.getByRole('heading', { name: 'Gestão de dados médicos', exact: true })).toBeVisible();
        if (operation === 'create') {
            await page.getByRole('button', { name: 'Cadastrar perfil', exact: true }).click();
            await page.getByRole('dialog').getByLabel(/^Associado/).fill(member.name);
            await page.getByRole('dialog').getByRole('button', { name: member.name, exact: true }).click();
        } else await page.getByRole('button', { name: `${deleting ? 'Excluir' : 'Editar'} perfil ${medical.id}`, exact: true }).click();
        const modal = page.getByRole('dialog');
        const contact = `Admin contato ${Date.now()}`;
        if (!deleting) await fillMedical(page, modal, contact);
        fail(scenario, deleting ? 'DELETE' : 'PUT', deleting ? `/admin/medical-profiles/${medical.id}` : `/admin/medical-profiles/users/${member.userId}`);
        await modal.getByRole('button', { name: deleting ? 'Confirmar exclusão' : 'Salvar alterações', exact: true }).click();
        if (scenario.key === 'sucesso') {
            await expect(status(page).filter({ hasText: deleting ? 'Perfil médico excluído.' : 'Dados médicos salvos com sucesso!' })).toBeVisible();
            await expect(modal).toHaveCount(0);
            if (deleting) await expect(page.getByRole('button', { name: `Visualizar perfil ${medical.id}`, exact: true })).toHaveCount(0);
            else {
                const saved = await app.api('medical-profiles/me', { token: member.session.accessToken });
                await page.getByRole('button', { name: `Visualizar perfil ${saved.id}`, exact: true }).click();
                await expect(page.getByRole('dialog').getByText(contact, { exact: true })).toBeVisible();
            }
        } else {
            await errorVisible(page, scenario);
            await expect(modal).toBeVisible();
            if (!deleting) await expect(modal.getByRole('textbox', { name: 'Nome', exact: true })).toHaveValue(contact);
            await expect(modal.getByRole('button', { name: deleting ? 'Confirmar exclusão' : 'Salvar alterações', exact: true })).toBeEnabled();
        }
    });
}

for (const scenario of [...cases, { key: '404', status: 404, error: 'Recurso não encontrado (404)' }]) {
    test(`UI consultar detalhe médico administrativo: ${scenario.key}`, userAction('/admin/dados-medicos', 'Visualizar perfil médico', scenario.error,
        scenario.key === 'sucesso' ? 'Exibe os dados médicos do perfil solicitado.' : 'Exibe erro no detalhe, oculta os dados e permite tentar novamente.',
        'admin/medical-profile/manage', 'getMedicalProfileAdminAction'), async ({ page }) => {
        const member = await app.member();
        const medical = await app.api('medical-profiles/me', { method: 'PUT', token: member.session.accessToken, body: medicalData('Contato reservado do detalhe') });
        await loginUser(page, app);
        await page.goto(`${app.baseURL}/admin/dados-medicos`);
        fail(scenario, 'GET', `/admin/medical-profiles/${medical.id}`);
        await page.getByRole('button', { name: `Visualizar perfil ${medical.id}`, exact: true }).click();
        const modal = page.getByRole('dialog');
        if (scenario.key === 'sucesso') await expect(modal.getByText('Contato reservado do detalhe', { exact: true })).toBeVisible();
        else {
            await expect(modal.getByRole('alert')).toBeVisible({ timeout: 15000 });
            await expect(modal.getByText('Contato reservado do detalhe', { exact: true })).toHaveCount(0);
            app.clear();
            await modal.getByRole('button', { name: 'Tentar novamente', exact: true }).click();
            await expect(modal.getByText('Contato reservado do detalhe', { exact: true })).toBeVisible();
        }
    });
}
