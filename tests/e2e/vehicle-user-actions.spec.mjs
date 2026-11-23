import { test, expect } from '@playwright/test';
import { randomInt } from 'node:crypto';
import { startUserActions, stopUserActions, loginUser, userAction } from './user-actions-harness.mjs';

test.use({ channel: process.env.E2E_BROWSER_CHANNEL || 'chrome' });
let app;
test.beforeAll(async () => { test.setTimeout(120000); app = await startUserActions(); });
test.afterAll(async () => { await stopUserActions(app); });
test.beforeEach(async () => { app.clear(); await app.refreshAdmin(); });
const scenarios = [
    { key: 'sucesso', error: 'Sem erro' },
    { key: '400', error: 'Dados inválidos (400)', status: 400 },
    { key: '403', error: 'Sem permissão (403)', status: 403 },
    { key: '409', error: 'Conflito (409)', status: 409 },
    { key: 'rede', error: 'Falha de rede', network: true },
    { key: '503', error: 'Serviço indisponível (503)', status: 503 },
];
const message = 'Não foi possível concluir a operação do veículo. Tente novamente.';
const modal = page => page.locator('[data-modal-content]').filter({ has: page.getByRole('heading', { name: /veículo/i }) });
function vehicleData() {
    const digits = Array.from({ length: 10 }, () => randomInt(10));
    const mod = digits.reduce((sum, n, i) => sum + n * [3, 2, 9, 8, 7, 6, 5, 4, 3, 2][i], 0) * 10 % 11;
    return { nickname: `Jipe UI ${Date.now()}`, plate: `Z${String.fromCharCode(65 + randomInt(26))}${String.fromCharCode(65 + randomInt(26))}${String(randomInt(10000)).padStart(4, '0')}`,
        renavam: digits.join('') + (mod === 10 ? 0 : mod), brand: 'Jeep', model: 'Wrangler', manufacturingYear: 2020, modelYear: 2021, color: 'Verde', seatingCapacity: 5, fuelType: 'DIESEL', engineDisplacement: 2, towing: false };
}
async function openVehicles(page, member) {
    await loginUser(page, app, member);
    await page.goto(`${app.baseURL}/profile`);
    await page.locator('#tour-profile-tab-vehicles').click();
    await expect(page.getByRole('heading', { name: 'Meus veículos', exact: true })).toBeVisible();
}
async function fillVehicle(page, data, edit) {
    const form = modal(page);
    if (!edit) { await form.getByLabel(/^Placa/).fill(data.plate); await form.getByLabel(/^Renavam/).fill(data.renavam); }
    await form.getByLabel(/^Marca/).fill(data.brand);
    await form.getByLabel(/^Apelido/).fill(data.nickname);
    await form.getByRole('button', { name: 'Próximo', exact: true }).click();
    await form.getByLabel(/^Modelo/).fill(data.model);
    await form.getByLabel(/^Cor/).fill(data.color);
    await form.getByLabel(/^Ano de fabricação/).fill(String(data.manufacturingYear));
    await form.getByLabel(/^Ano\/modelo/).fill(String(data.modelYear));
    await form.getByLabel(/^Assentos/).fill(String(data.seatingCapacity));
    await form.getByLabel(/^Cilindrada/).fill('2.0');
    await form.getByRole('combobox', { name: /Combustível/ }).click();
    await page.getByRole('option', { name: 'Diesel', exact: true }).click();
    await form.getByRole('button', { name: 'Próximo', exact: true }).click();
}
for (const operation of ['include', 'edit', 'delete']) for (const scenario of scenarios) {
    const action = { include: 'Cadastrar veículo', edit: 'Editar veículo', delete: 'Excluir veículo' }[operation];
    const functionName = { include: 'includeVehicleMemberAction', edit: 'editVehicleMemberAction', delete: 'deleteVehicleMemberAction' }[operation];
    test(`UI veículo ${operation}: ${scenario.key}`, userAction('/profile — veículos', action, scenario.error,
        scenario.key === 'sucesso' ? 'Exibe confirmação e atualiza a lista de veículos.' : 'Exibe toast de erro e mantém o formulário ou confirmação disponível para tentar novamente.', `vehicles/${operation}-member`, functionName), async ({ page }) => {
        const member = await app.member();
        const data = vehicleData(); let vehicle;
        if (operation !== 'include') {
            await app.api('vehicles/include/member', { method: 'POST', token: member.session.accessToken, body: data });
            vehicle = (await app.api('vehicles/list/member?size=50', { token: member.session.accessToken })).content.find(item => item.plate === data.plate);
            expect(vehicle).toBeDefined();
        }
        await openVehicles(page, member);
        if (operation === 'include') await page.getByRole('button', { name: 'Incluir Veículo', exact: true }).click();
        else await page.getByRole('button', { name: operation === 'edit' ? 'Editar' : 'Excluir', exact: true }).click();
        if (operation !== 'delete') { data.nickname = `Rascunho ${Date.now()}`; await fillVehicle(page, data, operation === 'edit'); }
        if (scenario.key !== 'sucesso') app.fail({ ...scenario, method: { include: 'POST', edit: 'PUT', delete: 'DELETE' }[operation], path: `/vehicles/${operation}/member${vehicle ? `/${vehicle.id}` : ''}`, detail: message });
        const submit = modal(page).getByRole('button', { name: { include: 'Cadastrar veículo', edit: 'Salvar', delete: 'Excluir' }[operation], exact: true });
        await submit.click();
        if (scenario.key === 'sucesso') {
            await expect(page.getByRole('status').filter({ hasText: { include: 'Veículo cadastrado com sucesso!', edit: 'Veículo atualizado com sucesso!', delete: 'Veículo excluído com sucesso!' }[operation] })).toBeVisible();
            await expect(modal(page)).toHaveCount(0);
            if (operation !== 'delete') await expect(page.getByRole('heading', { name: `${data.nickname} - ${data.model}`, exact: true })).toBeVisible();
            else await expect(page.getByRole('button', { name: 'Excluir', exact: true })).toHaveCount(0);
        } else {
            await expect(page.getByRole('status').filter({ hasText: scenario.network ? /conectar ao servidor|Verifique sua internet/ : message })).toBeVisible();
            await expect(submit).toBeEnabled();
            if (operation !== 'delete') {
                await modal(page).getByRole('button', { name: 'Etapa 1: Identificação', exact: true }).click();
                await expect(modal(page).getByLabel(/^Apelido/)).toHaveValue(data.nickname);
            }
            expect((await page.context().cookies()).some(cookie => cookie.name === 'AuthAccessToken' && cookie.value)).toBe(true);
        }
    });
}

for (const scenario of [scenarios[0], scenarios[2], { key: '404', error: 'Recurso não encontrado (404)', status: 404 }, scenarios[4]]) {
    test(`UI consulta veículo: ${scenario.key}`, userAction('/profile — veículos', 'Visualizar veículo', scenario.error,
        scenario.key === 'sucesso' ? 'Abre os detalhes do veículo cadastrado.' : 'Exibe aviso de erro e mantém a sessão sem mostrar dados do veículo.', 'vehicles/detail-member', 'getVehicleDetailAction'), async ({ page }) => {
        const member = await app.member(), data = vehicleData();
        await app.api('vehicles/include/member', { method: 'POST', token: member.session.accessToken, body: data });
        const vehicle = (await app.api('vehicles/list/member?size=50', { token: member.session.accessToken })).content.find(item => item.plate === data.plate);
        await openVehicles(page, member);
        if (scenario.key !== 'sucesso') app.fail({ ...scenario, method: 'GET', path: `/vehicles/detail/member/${vehicle.id}`, detail: message });
        await page.getByRole('button', { name: 'Visualizar', exact: true }).click();
        await expect(modal(page).getByRole('heading', { name: 'Detalhes do veículo', exact: true })).toBeVisible();
        if (scenario.key === 'sucesso') await expect(modal(page).getByText(data.nickname, { exact: true })).toBeVisible();
        else await expect(page.getByRole('status').filter({ hasText: scenario.network ? /conectar ao servidor|internet/ : message })).toBeVisible({ timeout: 15000 });
    });
}
