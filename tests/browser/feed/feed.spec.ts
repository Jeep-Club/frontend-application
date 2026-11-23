import { test, expect } from './fixtures';

test('menu principal mantém a ordem e mostra o Feed também no celular', async ({ page, api }, testInfo) => {
    await api.grant(['FEED_READ', 'NOTICE_CREATE']);
    await page.goto('/feed');
    await expect(page.getByRole('link', { name: 'Ver publicação completa: Aviso do clube', exact: true })).toBeVisible();
    if (testInfo.project.name.endsWith('-mobile')) {
        await page.getByRole('button', { name: 'Abrir menu lateral' }).click();
    }
    const menu = page.getByRole('navigation', { name: 'Menu principal' });
    await expect(menu.getByRole('link', { name: 'Feed', exact: true })).toBeVisible();
    await expect(menu.locator(':scope > a')).toHaveText(['Feed', 'Gestão', 'Histórico financeiro', 'Agenda', 'Avisos', 'Conta', 'Serviços']);
});

test('menu sem acesso administrativo mantém a ordem dos demais links', async ({ page }, testInfo) => {
    await page.goto('/feed');
    if (testInfo.project.name.endsWith('-mobile')) {
        await page.getByRole('button', { name: 'Abrir menu lateral' }).click();
    }
    const menu = page.getByRole('navigation', { name: 'Menu principal' });
    await expect(menu.locator(':scope > a')).toHaveText(['Feed', 'Histórico financeiro', 'Agenda', 'Avisos', 'Conta', 'Serviços']);
});

test('agenda mantém resumo e detalhe compartilhado por provider', async ({ page, api }) => {
    await page.goto('/agenda');
    await expect.poll(() => api.completed.some(url => url.pathname === '/publications/feed' && url.searchParams.get('size') === '48')).toBe(true);
    // Navigate the real calendar rather than changing only the client's clock,
    // which would deliberately diverge from the server-rendered current month.
    const currentMonth = await page.evaluate(() => new Date().getFullYear() * 12 + new Date().getMonth());
    const delta = 2027 * 12 + 10 - currentMonth;
    for (let month = 0; month < Math.abs(delta); month++) {
        await page.getByRole('button', { name: delta > 0 ? 'Próximo mês' : 'Mês anterior' }).click();
    }
    await page.getByRole('button', { name: /Passeio cancelado/ }).click();
    await expect(page.getByRole('heading', { name: 'Passeio cancelado' })).toBeVisible();
    await page.getByRole('button', { name: 'Ver evento e comentários' }).click();
    await expect(page.getByRole('dialog').getByText('Autor — identificação #7')).toBeVisible();
    await page.getByRole('button', { name: 'Fechar publicação' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page).toHaveURL(/\/agenda$/);
});

test('criação contextual existente continua disponível sem executar escrita', async ({ page, api }) => {
    await api.grant(['FEED_READ', 'NOTICE_CREATE']);
    await page.goto('/feed?type=NOTICE');
    await page.getByRole('button', { name: 'Criar aviso', exact: true }).click();
    await expect(page).toHaveURL(/\/feed\/new\?type=NOTICE/);
    await expect(page.getByRole('dialog').getByRole('heading', { name: 'Criar aviso' })).toBeVisible();
    await page.getByRole('dialog').getByRole('button', { name: 'Cancelar', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page).toHaveURL(/type=NOTICE/);
});

test('participação existente recebe foco e Escape retorna ao detalhe', async ({ page, api }) => {
    api.eventOpen = true;
    await api.grant(['PUBLICATION_READ', 'EVENT_REGISTER']);
    await page.goto('/feed/2');
    await expect(page.getByRole('dialog').getByText('Autor — identificação #7')).toBeVisible();
    await page.getByRole('dialog').getByRole('button', { name: 'Participar do evento' }).click();
    await expect(page.getByRole('heading', { name: 'Como você vai participar?' })).toBeVisible();
    await expect(page.getByText(/Após confirmar, se houver cobrança configurada para este evento/)).toBeVisible();
    const vehicles = page.getByRole('radiogroup', { name: 'Selecione seu veículo' });
    await expect(vehicles).toHaveAccessibleDescription('Selecione o veículo que você usará no evento.');
    await expect(page.getByText('Selecione o veículo que você usará no evento.')).toBeVisible();
    const confirm = page.getByRole('button', { name: 'Confirmar participação' });
    await expect(confirm).toBeDisabled();
    await vehicles.getByRole('radio', { name: /Jipe sintético/ }).click();
    await expect(confirm).toBeEnabled();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog').getByText('Autor — identificação #7')).toBeVisible();
    await expect(page).toHaveURL(/\/feed\/2/);
});

test('inscrição pendente leva ao histórico pessoal de cobranças', async ({ page, api }) => {
    api.eventOpen = true;
    await api.grant(['PUBLICATION_READ', 'EVENT_REGISTER', 'EVENT_REGISTRATION_READ']);
    await page.goto('/feed/2');
    await expect(page.getByRole('dialog').getByText('Autor — identificação #7')).toBeVisible();
    await page.getByRole('dialog').getByRole('button', { name: 'Participar do evento' }).click();
    await expect(page.getByRole('heading', { name: 'Como você vai participar?' })).toBeVisible();
    await page.getByRole('radio', { name: /Jipe sintético/ }).click();
    await page.getByRole('button', { name: 'Confirmar participação' }).click();
    const detail = page.getByRole('dialog');
    await expect(detail.getByRole('link', { name: 'Ver cobranças e pagamentos' })).toHaveAttribute('href', '/financeiro');
    await expect(detail.getByText('Inscrição pendente de pagamento')).toBeVisible();
});

test('sidebar distingue erro de consulta e usa tamanho solicitado', async ({ page, api }) => {
    api.eventFeedStatus = 503;
    await page.goto('/feed');
    if (page.viewportSize()!.width < 1024) await page.getByRole('button', { name: 'Abrir painel de eventos, aniversariantes e avisos' }).click();
    const sidebar = page.getByRole(page.viewportSize()!.width < 1024 ? 'dialog' : 'complementary', { name: 'Informações do clube' });
    await expect(sidebar.getByRole('alert').first()).toContainText('temporariamente indisponível');
    expect(api.calls.some(url => url.searchParams.get('type') === 'EVENT' && url.searchParams.get('size') === '48')).toBe(true);
});

test('sidebar interrompe paginação em erro e recupera sem toasts duplicados', async ({ page, api }) => {
    api.eventFeedStatus = 503;
    api.noticeFeedStatus = 503;
    await page.goto('/feed');
    if (page.viewportSize()!.width < 1024) await page.getByRole('button', { name: 'Abrir painel de eventos, aniversariantes e avisos' }).click();
    const sidebar = page.getByRole(page.viewportSize()!.width < 1024 ? 'dialog' : 'complementary', { name: 'Informações do clube' });
    await expect(sidebar.getByRole('button', { name: 'Tentar eventos novamente' })).toBeVisible();
    await expect(sidebar.getByRole('button', { name: 'Tentar avisos novamente' })).toBeVisible();
    const count = () => api.calls.filter(url => url.pathname === '/publications/feed' && url.searchParams.get('type') === 'EVENT').length;
    // Dev Strict Mode remounts the authenticated boundary and clears its cache.
    // Measure retries after initialization, independently of that dev lifecycle.
    const initialRequests = count();
    expect(initialRequests).toBeGreaterThan(0);
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    api.eventFeedStatus = 200;
    await sidebar.getByRole('button', { name: 'Tentar eventos novamente' }).click();
    await expect(sidebar.getByRole('button', { name: 'Tentar eventos novamente' })).toHaveCount(0);
    await expect.poll(count).toBe(initialRequests + 1);
    await expect(page.getByRole('status').filter({ hasText: 'Resposta sintética corrigível.' })).toHaveCount(0);
});

test('falha de imagem conserva leitura e galeria navegável', async ({ page, api }) => {
    api.mediaFails = true;
    await page.goto('/feed/1');
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('Imagem indisponível.')).toBeVisible();
    await expect(dialog.getByText('Conteúdo completo para os associados.')).toBeVisible();
    await dialog.getByRole('button', { name: 'Próxima foto' }).click();
    await expect(dialog.getByText('Foto 2 de 2')).toBeVisible();
});

test('período exato, tipos, deep link e retorno preservam contexto', async ({ page, api }) => {
    await page.goto('/feed?publishedFrom=2026-10-29T12%3A00%3A00.123456Z');
    await expect(page.getByRole('link', { name: 'Ver publicação completa: Aviso do clube', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Filtrar por período' }).click();
    await page.getByRole('button', { name: 'Aplicar período' }).click();
    await expect.poll(() => api.calls.some(url => url.searchParams.get('publishedFrom') === '2026-10-29T12:00:00.123456Z')).toBe(true);
    await page.getByRole('button', { name: 'Serviços', exact: true }).click();
    const link = page.getByRole('link', { name: 'Ver publicação completa: Serviço anunciado', exact: true });
    await expect(link).toBeVisible();
    await link.click();
    await expect(page).toHaveURL(/\/feed\/3/);
    await expect(page.getByRole('dialog').getByText('Autor — identificação #7')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page).toHaveURL(/\/feed\?/);
    await expect(page).toHaveURL(/publishedFrom=/);
    await link.click();
    await expect(page).toHaveURL(/\/feed\/3\?/);
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL(/\/feed\?/);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.goForward();
    await expect(page).toHaveURL(/\/feed\/3\?/);
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.reload();
    await expect(page.getByRole('dialog').getByText('Serviço anunciado', { exact: true })).toBeVisible();
});

test('detalhe 402 encaminha aos débitos sem expor a publicação ou encerrar a sessão', async ({ page, api }) => {
    api.detailStatus = 402;
    await page.goto('/feed/1');
    await expect(page).toHaveURL(/\/financeiro$/);
    expect(api.calls.some(url => url.pathname === '/publications/1')).toBe(true);
    await expect(page.getByText('Conteúdo completo para os associados.', { exact: true })).toHaveCount(0);
    expect((await page.context().cookies()).some(cookie => cookie.name === 'AuthAccessToken')).toBe(true);
});

for (const [status, message] of [[403, 'Acesso negado'], [404, 'Publicação não encontrada'], [503, 'temporariamente indisponível']] as const) {
    test(`detalhe ${status} não vira vazio nem logout`, async ({ page, api }) => {
        api.detailStatus = status;
        await page.goto('/feed/1');
        await expect(page.getByRole('dialog').getByRole('alert')).toContainText(message);
        await expect(page).toHaveURL(/\/feed/);
        await expect(page.getByRole('dialog').getByText('Conteúdo completo para os associados.')).toHaveCount(0);
        await page.getByRole('button', { name: 'Fechar publicação' }).click();
        await expect(page.getByRole('dialog')).toHaveCount(0);
    });
}

test('intervalo inválido não consulta e pode ser corrigido', async ({ page, api }) => {
    await page.goto('/feed?type=ALL');
    await expect(page.getByText('Revise os filtros da URL.', { exact: false })).toBeVisible();
    expect(api.calls.filter(url => url.pathname === '/publications/feed' && url.searchParams.get('size') === '12')).toHaveLength(0);
    await page.getByRole('button', { name: 'Limpar filtros' }).click();
    await expect(page.getByRole('link', { name: 'Ver publicação completa: Aviso do clube', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Filtrar por período' }).click();
    for (const [label, day] of [['Publicada a partir de', '30'], ['Publicada até', '29']] as const) {
        const segments = page.getByRole('group', { name: label, exact: true }).getByRole('spinbutton');
        for (const [index, value] of [day, '10', '2026', '12', '00'].entries()) await segments.nth(index).fill(value);
    }
    await page.getByRole('button', { name: 'Aplicar período' }).click();
    await expect(page.getByText('O fim deve ser igual ou posterior ao início.')).toBeVisible();
});

test('sessão autenticada consulta feed e detalhe sem permissões granulares de leitura', async ({ page, api }) => {
    await api.grant([]);
    await page.goto('/feed/1');
    await expect(page.getByRole('dialog').getByText('Autor — identificação #7')).toBeVisible();
    await page.getByRole('button', { name: 'Fechar publicação' }).click();
    await expect.poll(() => api.calls.some(url => url.pathname === '/publications/feed')).toBe(true);
});

test('paginação via URL consulta o servidor e permite recuperar erro', async ({ page, api }) => {
    api.pages = 2; api.failPage = 1;
    await page.goto('/feed');
    await expect(page.locator('article')).toHaveCount(3);
    await page.getByRole('button', { name: 'Próximas publicações' }).click();
    await expect(page).toHaveURL(/page=1/);
    await expect(page.getByRole('button', { name: 'Tentar novamente', exact: true })).toBeVisible();
    api.failPage = -1;
    await page.getByRole('button', { name: 'Tentar novamente', exact: true }).click();
    await expect(page.locator('article')).toHaveCount(3);
    await expect(page.getByRole('button', { name: 'Publicações anteriores' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Próximas publicações' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Publicações anteriores' }).click();
    await expect(page).toHaveURL(/page=0/);
});

test('resposta atrasada de filtro anterior não substitui seleção atual', async ({ page, api }) => {
    await page.goto('/feed');
    await expect(page.getByRole('link', { name: 'Ver publicação completa: Aviso do clube', exact: true })).toBeVisible();
    api.delay = 1000;
    await page.getByRole('button', { name: 'Avisos', exact: true }).click();
    await expect.poll(() => api.calls.some(url => url.searchParams.get('type') === 'NOTICE' && url.searchParams.get('size') === '12')).toBe(true);
    await page.getByRole('button', { name: 'Serviços', exact: true }).click();
    await expect(page.getByRole('link', { name: 'Ver publicação completa: Serviço anunciado', exact: true })).toBeVisible();
    await expect.poll(() => api.completed.some(url => url.searchParams.get('type') === 'NOTICE' && url.searchParams.get('size') === '12')).toBe(true);
    await expect(page.locator('article')).toHaveCount(1);
    await expect(page.locator('article')).toContainText('Serviço anunciado');
    await expect(page).toHaveURL(/type=SERVICE/);
});

test('revalidação 404 retira detalhe previamente disponível', async ({ page, api }) => {
    await page.goto('/feed/1');
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('Conteúdo completo para os associados.')).toBeVisible();
    api.detailStatus = 404;
    await dialog.getByRole('button', { name: 'Atualizar publicação' }).click();
    await expect(dialog.getByRole('alert')).toContainText('Publicação não encontrada');
    await expect(dialog.getByText('Conteúdo completo para os associados.')).toHaveCount(0);
});

for (const theme of ['light', 'dark']) {
    test(`tema ${theme} e conteúdo cabem no viewport`, async ({ page }) => {
        await page.addInitScript(value => localStorage.setItem('jeep-clube-theme', value), theme);
        await page.goto('/feed');
        await expect(page.getByRole('link', { name: 'Ver publicação completa: Aviso do clube', exact: true })).toBeVisible();
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
        await page.getByRole('link', { name: 'Ver publicação completa: Aviso do clube', exact: true }).click();
        await expect(page.getByRole('dialog')).toBeVisible();
        expect(await page.getByRole('dialog').evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    });
}

test('401 recuperável renova sessão sem perder o detalhe', async ({ page, api }) => {
    api.unauthorizedOnce = true;
    await page.goto('/feed/1');
    await expect(page.getByRole('dialog').getByText('Autor — identificação #7')).toBeVisible();
    expect(api.calls.some(url => url.pathname === '/authentication/refresh')).toBe(true);
    await expect(page).toHaveURL(/\/feed\/1/);
});

test('sessão expirada usa recuperação transversal e retorna à entrada pública', async ({ page, api }) => {
    api.unauthorizedOnce = true;
    api.refreshFails = true;
    await page.goto('/feed/1');
    await expect(page).toHaveURL(new URL('/', page.url()).href);
    const cookies = await page.context().cookies();
    expect(cookies.some(cookie => ['AuthAccessToken', 'AuthRefreshToken', 'Me', 'Permissions'].includes(cookie.name))).toBe(false);
});

test('feed vazio e nenhum resultado são diferentes de falha', async ({ page, api }) => {
    api.empty = true;
    await page.goto('/feed');
    await expect(page.getByRole('heading', { name: 'Nenhuma publicação por aqui' })).toBeVisible();
    await page.getByRole('button', { name: 'Avisos', exact: true }).click();
    await expect(page.getByText('Nenhum resultado para os filtros selecionados.')).toBeVisible();
    await expect(page.locator('article')).toHaveCount(0);
});

test('URL inválida desabilita continuação mesmo com páginas no cache', async ({ page, api }) => {
    api.pages = 2;
    await page.goto('/feed');
    await expect(page.getByRole('link', { name: 'Ver publicação completa: Aviso do clube', exact: true })).toBeVisible();
    await page.evaluate(() => window.history.replaceState(null, '', '/feed?type=ALL'));
    await expect(page.getByText('Revise os filtros da URL.', { exact: false })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Atualizar publicações' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Próximas publicações' })).toHaveCount(0);
});

for (const status of [400, 500]) {
    test(`falha ${status} do feed oferece recuperação sem vazio`, async ({ page, api }) => {
        api.listStatus = status;
        await page.goto('/feed');
        await expect(page.getByRole('button', { name: 'Tentar novamente', exact: true })).toBeVisible();
        await expect(page.getByRole('heading', { name: 'Nenhuma publicação por aqui' })).toHaveCount(0);
        api.listStatus = 200;
        await page.getByRole('button', { name: 'Tentar novamente', exact: true }).click();
        await expect(page.getByRole('link', { name: 'Ver publicação completa: Aviso do clube', exact: true })).toBeVisible();
    });
}

test('filtro de período abre seletores e mantém precisão dos limites existentes', async ({ page, api }) => {
    await page.goto('/feed?publishedFrom=2026-10-29T12%3A00%3A00.123456Z');
    const filter = page.getByRole('button', { name: 'Filtrar por período' });
    await filter.click();
    await expect(page.getByRole('group', { name: 'Publicada a partir de' })).toBeVisible();
    await page.getByRole('button', { name: 'Abrir calendário: Publicada a partir de' }).click();
    await expect(page.getByRole('dialog').getByRole('grid')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Aplicar período' })).toBeVisible();
    await page.getByRole('button', { name: 'Aplicar período' }).click();
    await expect(page.getByRole('button', { name: 'Aplicar período' })).toHaveCount(0);
    await expect.poll(() => api.calls.some(url => url.searchParams.get('publishedFrom') === '2026-10-29T12:00:00.123456Z')).toBe(true);
    await filter.click();
    await page.getByRole('button', { name: 'Limpar período' }).click();
    await expect(page).not.toHaveURL(/publishedFrom/);
});

test('calendário do feed destaca eventos de todas as páginas e leva à agenda', async ({ page, api }) => {
    const now = new Date();
    api.eventStartsAt = new Date(now.getFullYear(), now.getMonth(), 10, 12).toISOString();
    api.pages = 2;
    await page.goto('/feed');
    if (page.viewportSize()!.width < 1024) await page.getByRole('button', { name: 'Abrir painel de eventos, aniversariantes e avisos' }).click();
    const sidebar = page.getByRole(page.viewportSize()!.width < 1024 ? 'dialog' : 'complementary', { name: 'Informações do clube' });
    await expect.poll(() => api.completed.some(url => url.searchParams.get('type') === 'EVENT' && url.searchParams.get('page') === '1')).toBe(true);
    await expect(sidebar.getByLabel('10: 2 eventos')).toBeVisible();
    await expect(sidebar.getByLabel('Eventos do dia 10')).toHaveCount(0);
    await expect(sidebar.getByRole('link', { name: 'Veja mais' })).toHaveAttribute('href', '/agenda');
    await expect(sidebar.getByRole('button', { name: 'Postar' })).toHaveCount(0);
});
