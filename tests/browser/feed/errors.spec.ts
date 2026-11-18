import { test, expect } from './fixtures';
import scenarios from '../../test-docs-cases.json';

test('ERR-MEMBERSHIP negação definitiva remove o feed e encaminha aos débitos', async ({ page, api }) => {
    api.feedStatus = 402;
    await page.goto('/feed');
    await expect(page).toHaveURL(/\/financeiro$/);
    await expect(page.getByRole('heading', { name: 'Acesso bloqueado por falta de pagamento', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Ver publicação completa: Aviso do clube', exact: true })).toHaveCount(0);
});

for (const scenario of scenarios.filter(scenario => scenario.status)) {
    test(`${scenario.match} detalhe não expõe conteúdo nem encerra sessão`, async ({ page, api }) => {
        api.detailStatus = scenario.status!;
        await page.goto('/feed/1');
        const dialog = page.getByRole('dialog');
        await expect(dialog.getByRole('alert')).toBeVisible();
        await expect(dialog.getByText('Conteúdo completo para os associados.', { exact: true })).toHaveCount(0);
        await expect(dialog.getByRole('button', { name: 'Tentar novamente', exact: true })).toBeVisible();
        expect((await page.context().cookies()).some(cookie => cookie.name === 'AuthAccessToken')).toBe(true);
        api.detailStatus = 200;
        await dialog.getByRole('button', { name: 'Tentar novamente', exact: true }).click();
        await expect(dialog.getByText('Conteúdo completo para os associados.', { exact: true })).toBeVisible();
    });
}

test('ERR-LIKE falha de escrita não altera curtida e permite recuperar', async ({ page, api }) => {
    await api.grant(['INTERACTION_LIKE']);
    await page.goto('/feed/1');
    const dialog = page.getByRole('dialog');
    api.likeStatus = 500;
    await dialog.getByRole('button', { name: 'Curtir publicação', exact: true }).click();
    await expect(dialog.getByRole('alert')).toContainText('Não foi possível atualizar sua curtida');
    await expect(dialog.getByRole('button', { name: 'Curtir publicação', exact: true })).toHaveAttribute('aria-pressed', 'false');
    await expect(dialog.getByRole('button', { name: 'Curtir publicação', exact: true })).toHaveText('0');
    api.likeStatus = 200;
    await dialog.getByRole('button', { name: 'Curtir publicação', exact: true }).click();
    await expect(dialog.getByRole('button', { name: 'Remover curtida', exact: true })).toHaveText('1');
});

test('ERR-COMMENT falha de envio mantém rascunho e reenvio cria um único comentário', async ({ page, api }) => {
    await api.grant(['COMMENT_CREATE']);
    await page.goto('/feed/1');
    const comments = page.getByRole('region', { name: 'Comentários', exact: true });
    await comments.getByLabel('Seu comentário').fill('Rascunho preservado');
    api.commentsStatus = 500;
    await comments.getByRole('button', { name: 'Comentar', exact: true }).click();
    await expect.poll(() => api.writes.filter(call => call.pathname.endsWith('/comments')).length).toBe(1);
    await expect(comments.getByRole('button', { name: 'Comentar', exact: true })).toBeEnabled();
    await expect(comments.getByLabel('Seu comentário')).toHaveValue('Rascunho preservado');
    expect(api.comments[1] ?? []).toHaveLength(0);
    api.commentsStatus = 200;
    await comments.getByRole('button', { name: 'Comentar', exact: true }).click();
    await expect(comments.getByLabel('Seu comentário')).toHaveValue('');
    expect(api.comments[1]).toHaveLength(1);
});
