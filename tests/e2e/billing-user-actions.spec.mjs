import { test, expect } from '@playwright/test';
import { startUserActions, stopUserActions, loginUser } from './user-actions-harness.mjs';
import { testPng } from './local-api.mjs';

test.use({ channel: process.env.E2E_BROWSER_CHANNEL || 'chrome' });
let app;
test.beforeAll(async () => { test.setTimeout(120000); app = await startUserActions(); });
test.afterAll(async () => { await stopUserActions(app); });
test.beforeEach(async () => { app.clear(); await app.refreshAdmin(); });
const scenarios = [{ key: 'sucesso', error: 'Sem erro' }, { key: '400', status: 400, error: 'Dados inválidos (400)' }, { key: '403', status: 403, error: 'Sem permissão (403)' }, { key: 'rede', network: true, error: 'Falha de rede' }];
const message = 'Não foi possível concluir a operação financeira de teste.';
const modal = page => page.locator('[data-modal-content]');
const toast = page => page.locator('[role="status"]');
const annotate = (actionId, action, scenario, response, source, exportName) => ({ annotation: { type: 'user-action', description: JSON.stringify({ actionId, screen: '/admin/gestao-financeira', action, error: scenario.error, response, source: `/src/server/actions/${source}.ts`, exportName }) } });
async function failed(page, scenario) {
    await expect(toast(page).filter({ hasText: scenario.network ? /conectar ao servidor|Verifique sua internet/i : message })).toBeVisible({ timeout: 15000 });
    expect((await page.context().cookies()).some(cookie => cookie.name === 'AuthAccessToken' && cookie.value)).toBe(true);
}
async function definition() {
    return app.api('billing/charge-definitions', { method: 'POST', token: app.admin.accessToken, body: { name: `ZZZ UI ${Date.now()}`, description: 'Cobrança sintética.', defaultAmount: 25, recurrenceType: 'ONE_TIME', required: false, paymentAcceptancePolicy: 'AFTER_DUE_DATE', latePaymentGraceDays: null } });
}
async function openDefinitions(page) {
    await loginUser(page, app);
    await page.goto(`${app.baseURL}/admin/gestao-financeira/cobrancas?tab=definitions`);
    await page.getByLabel('Ordenar definições', { exact: true }).selectOption('name,desc');
}
async function choose(page, label, option) { await page.getByRole('combobox', { name: new RegExp(label) }).click(); await page.getByRole('option', { name: option, exact: false }).click(); }
async function fillDefinition(page, name) {
    await modal(page).getByLabel(/^Nome da cobrança/).fill(name);
    await modal(page).getByLabel('Descrição', { exact: true }).fill('Descrição editada pela interface.');
    await modal(page).getByLabel(/^Valor padrão/).fill('2500');
    await choose(page, 'Tipo de recorrência', 'Cobrança única');
    await choose(page, 'Política de aceitação', 'Sem limite após o vencimento');
}

for (const operation of ['create', 'update', 'archive']) for (const scenario of scenarios) {
    const action = { create: 'Criar definição de cobrança', update: 'Editar definição de cobrança', archive: 'Arquivar definição de cobrança' }[operation];
    test(`BILLING definição ${operation}: ${scenario.key}`, annotate(`${operation}ChargeDefinition`, action, scenario, scenario.key === 'sucesso' ? 'Exibe confirmação e atualiza a lista de definições.' : 'Exibe aviso de erro, mantém os dados ou a confirmação e permite tentar novamente.', `billing/chargeDefinitions/${operation}`, `${operation}ChargeDefinitionAction`), async ({ page }) => {
        const record = operation === 'create' ? null : await definition();
        await openDefinitions(page);
        if (record) await page.getByRole('button', { name: `${operation === 'update' ? 'Editar' : 'Arquivar'} ${record.name}`, exact: true }).click();
        else await page.getByRole('button', { name: 'Criar definição', exact: true }).click();
        const name = `ZZZ UI editada ${Date.now()}`;
        if (operation !== 'archive') await fillDefinition(page, name);
        if (scenario.key !== 'sucesso') app.fail({ ...scenario, method: { create: 'POST', update: 'PUT', archive: 'PATCH' }[operation], path: `/billing/charge-definitions${record ? `/${record.id}` : ''}${operation === 'archive' ? '/archive' : ''}`, detail: message });
        const submit = modal(page).getByRole('button', { name: { create: 'Criar definição', update: 'Salvar alterações', archive: 'Arquivar' }[operation], exact: true });
        await submit.click();
        if (scenario.key === 'sucesso') await expect(toast(page).filter({ hasText: { create: 'Definição de cobrança criada com sucesso!', update: 'Definição de cobrança atualizada com sucesso!', archive: 'Definição de cobrança arquivada com sucesso!' }[operation] })).toBeVisible();
        else { await failed(page, scenario); await expect(submit).toBeEnabled(); if (operation !== 'archive') await expect(modal(page).getByLabel(/^Nome da cobrança/)).toHaveValue(name); }
    });
}

for (const scenario of scenarios) {
    test(`BILLING gerar ciclo: ${scenario.key}`, annotate('generateChargeCycle', 'Gerar cobrança', scenario, scenario.key === 'sucesso' ? 'Confirma a geração do ciclo de cobrança.' : 'Exibe aviso de erro e mantém o código e vencimento para nova tentativa.', 'billing/chargeCycles/generate', 'generateChargeCycleAction'), async ({ page }) => {
        const record = await definition();
        const member = await app.member();
        await app.api(`billing/charge-definitions/${record.id}/assignments/users/${member.userId}`, { method: 'POST', token: app.admin.accessToken });
        await openDefinitions(page);
        await page.getByRole('button', { name: `Gerar cobrança para ${record.name}`, exact: true }).click();
        const code = `UI-CYCLE-${Date.now()}`;
        await modal(page).getByLabel(/^Código do ciclo/).fill(code);
        await modal(page).getByLabel(/^Data de vencimento/).fill('2030-12-31');
        if (scenario.key !== 'sucesso') app.fail({ ...scenario, method: 'POST', path: `/billing/charge-definitions/${record.id}/cycles`, detail: message });
        await modal(page).getByRole('button', { name: 'Gerar cobrança', exact: true }).click();
        if (scenario.key === 'sucesso') await expect(toast(page).filter({ hasText: /Ciclo gerado/ })).toBeVisible();
        else { await failed(page, scenario); await expect(modal(page).getByLabel(/^Código do ciclo/)).toHaveValue(code); await expect(modal(page).getByRole('button', { name: 'Gerar cobrança', exact: true })).toBeEnabled(); }
    });
}

for (const scenario of scenarios) {
    test(`BILLING atribuição a todos: ${scenario.key}`, annotate('assignChargeToAllMembers', 'Atribuir cobrança a todos os membros', scenario, scenario.key === 'sucesso' ? 'Exibe confirmação e retorna à lista de atribuições.' : 'Exibe aviso de erro e mantém o público-alvo selecionado para nova tentativa.', 'billing/chargeAssignments/assign', 'assignChargeToAllMembersAction'), async ({ page }) => {
        const record = await definition(); await openDefinitions(page);
        await page.getByRole('button', { name: `Associar membros a ${record.name}`, exact: true }).click();
        await modal(page).getByRole('button', { name: 'Adicionar atribuição', exact: true }).click();
        await choose(page, 'Público-alvo', 'Todos os membros');
        if (scenario.key !== 'sucesso') app.fail({ ...scenario, method: 'POST', path: `/billing/charge-definitions/${record.id}/assignments/all-members`, detail: message });
        await modal(page).getByRole('button', { name: 'Adicionar atribuição', exact: true }).click();
        if (scenario.key === 'sucesso') await expect(toast(page).filter({ hasText: 'Atribuição criada com sucesso!' })).toBeVisible();
        else { await failed(page, scenario); await expect(modal(page).getByRole('combobox', { name: /Público-alvo/ })).toContainText('Todos os membros'); await expect(modal(page).getByRole('button', { name: 'Adicionar atribuição', exact: true })).toBeEnabled(); }
    });
}

async function seedPayment() {
    const member = await app.member(); const record = await definition();
    await app.api(`billing/charge-definitions/${record.id}/assignments/users/${member.userId}`, { method: 'POST', token: app.admin.accessToken });
    await app.api(`billing/charge-definitions/${record.id}/cycles`, { method: 'POST', token: app.admin.accessToken, body: { code: `PAYMENT-UI-${Date.now()}`, dueDate: '2030-12-31' } });
    const charges = await app.api('billing/me/member-charges?size=50', { token: member.session.accessToken });
    const charge = charges.content.find(item => item.chargeDefinitionId === record.id);
    const body = new FormData(); body.set('amount', '25'); body.set('paymentMethod', 'PIX'); body.set('paidAt', new Date().toISOString()); body.set('receiptFile', new Blob([testPng], { type: 'image/png' }), 'receipt.png');
    const payment = await app.api(`billing/member-charges/${charge.id}/payments`, { method: 'POST', token: member.session.accessToken, body });
    return { payment, charge };
}

for (const operation of ['confirm', 'reject']) for (const scenario of scenarios) {
    test(`BILLING pagamento ${operation}: ${scenario.key}`, annotate(`mutateBilling:payments:${operation}`, operation === 'confirm' ? 'Confirmar pagamento' : 'Rejeitar pagamento', scenario, scenario.key === 'sucesso' ? 'Confirma a operação e atualiza a situação do pagamento.' : 'Exibe aviso de erro e mantém a confirmação aberta para nova tentativa.', 'billing/management', 'mutateBillingAction'), async ({ page }) => {
        const { charge } = await seedPayment();
        await loginUser(page, app);
        await page.goto(`${app.baseURL}/admin/gestao-financeira/movimentacoes?movement=payments&status=PENDING_VALIDATION`);
        const card = page.getByRole('article').filter({ has: page.getByText(`#${charge.id}`, { exact: true }) });
        await card.getByRole('button', { name: operation === 'confirm' ? 'Confirmar pagamento' : 'Rejeitar pagamento', exact: true }).click();
        const dialog = page.getByRole('dialog', { name: operation === 'confirm' ? 'Confirmar pagamento' : 'Rejeitar pagamento', exact: true });
        if (operation === 'reject') await dialog.getByRole('textbox', { name: 'Motivo da rejeição', exact: true }).fill('Comprovante ilegível no teste.');
        // Read details first; only the mutation response is failed.
        await expect(dialog.getByRole('button', { name: 'Confirmar operação', exact: true })).toBeEnabled();
        const paymentId = (await dialog.getByRole('heading').textContent()).match(/#(\d+)/)[1];
        if (scenario.key !== 'sucesso') app.fail({ ...scenario, method: 'PATCH', path: `/billing/member-payments/${paymentId}/${operation}`, detail: message });
        await dialog.getByRole('button', { name: 'Confirmar operação', exact: true }).click();
        if (scenario.key === 'sucesso') await expect(toast(page).filter({ hasText: 'Operação concluída.' })).toBeVisible();
        else { await failed(page, scenario); await expect(dialog.getByRole('alert')).toContainText(scenario.network ? /conectar ao servidor|internet/i : message); await expect(dialog.getByRole('button', { name: 'Confirmar operação', exact: true })).toBeEnabled(); if (operation === 'reject') await expect(dialog.getByRole('textbox', { name: 'Motivo da rejeição', exact: true })).toHaveValue('Comprovante ilegível no teste.'); }
    });
}
