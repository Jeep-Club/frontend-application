import { test } from 'node:test';
import assert from 'node:assert/strict';
import { csvField, toCsv, normalizeJest, normalizePlaywright, parseArgs, relativeTestPath } from '../../scripts/test-docs.mjs';

test('CSV uses BOM, quoted semicolon fields and formula-safe spreadsheet values', () => {
    assert.equal(csvField('  =SUM(1;2)'), '"\'  =SUM(1;2)"');
    assert.equal(csvField('\t@x'), '"\'\t@x"');
    assert.equal(csvField('-1'), '"\'-1"');
    assert.equal(csvField('+x'), '"\'+x"');
    assert.equal(csvField('a;"b"\nc'), '"a;""b""\nc"');
    const csv = toCsv([{ title: 'Teste', actual: 'OK', documented: true, screen: '/feed', simulatedError: 'Sem acesso', response: 'Exibe erro', file: 'C:/projeto/tests/feed.spec.ts' }], { author: '=danger' });
    assert.ok(csv.startsWith('\uFEFF"Tela";"Erro simulado";"Resposta esperada";"Resultado"'));
    assert.ok(csv.includes('Exibe erro'));
    assert.ok(csv.includes('/tests/feed.spec.ts'));
    assert.ok(!csv.includes('C:/projeto'));
    assert.equal(relativeTestPath('C:\\projeto\\tests\\feed.spec.ts'), '/tests/feed.spec.ts');
    assert.equal(relativeTestPath('/tests/feed.spec.ts'), '/tests/feed.spec.ts');
    assert.equal(relativeTestPath('feed/errors.spec.ts', 'Playwright'), '/tests/browser/feed/errors.spec.ts');
    assert.ok(csv.includes('"\'=danger"'));
});

test('Jest separates success, failure, pending and uncollected suite errors', () => {
    const rows = normalizeJest({ testResults: [{ name: 'tests/a.spec.ts', status: 'failed', assertionResults: [
        { fullName: 'Feed leitura', status: 'passed' }, { fullName: 'erro', status: 'failed', failureMessages: ['erro real'] },
        { title: 'pendente', status: 'pending' }, { title: 'todo', status: 'todo' },
    ] }, { name: 'tests/b.spec.ts', status: 'failed', message: 'SyntaxError', assertionResults: [] }] }, [
        { match: 'Feed leitura', screen: '/feed', error: 'Sem erro simulado', expected: 'OK' },
    ]);
    assert.deepEqual(rows.map(row => row.actual), ['OK', 'NAO', 'NAO EXECUTADO', 'NAO EXECUTADO', 'NAO EXECUTADO']);
    assert.equal(rows[0].screen, '/feed');
    assert.equal(rows[1].documented, false);
    assert.equal(rows[0].documented, true);
    assert.equal(toCsv(rows).split('\r\n').length, 3);
    assert.equal(rows[1].error, 'erro real');
    assert.equal(rows[4].error, 'SyntaxError');
    assert.throws(() => normalizeJest({}), /testResults/);
});

test('Jest test.failing reports expected failure without turning it into a successful actual outcome', () => {
    const rows = normalizeJest({ testResults: [{ name: 'failing.spec.ts', assertionResults: [
        { fullName: 'falha esperada', failing: true, status: 'passed' },
        { fullName: 'passou inesperadamente', failing: true, status: 'failed' },
    ] }] });
    assert.deepEqual(rows.map(row => [row.expected, row.actual]), [['NAO', 'NAO'], ['NAO', 'OK']]);
});

test('Playwright preserves expected-failed, flaky, skipped and actual last retry outcome', () => {
    const scenarios = [
        { status: 'expected', expectedStatus: 'passed', results: [{ status: 'passed' }] },
        { status: 'unexpected', expectedStatus: 'passed', results: [{ status: 'failed', errors: [{ message: 'falhou' }] }] },
        { status: 'skipped', expectedStatus: 'skipped', results: [{ status: 'skipped' }] },
        { status: 'flaky', expectedStatus: 'passed', results: [{ status: 'failed' }, { status: 'passed' }] },
        { status: 'expected', expectedStatus: 'failed', results: [{ status: 'failed' }] },
        { status: 'unexpected', expectedStatus: 'failed', results: [{ status: 'passed' }] },
        { status: 'skipped', results: [] },
    ];
    const rows = normalizePlaywright({ suites: [{ title: 'arquivo', file: 'tests/browser/a.ts', suites: [{ title: 'Feed', specs: scenarios.map((scenario, index) => ({ title: `caso ${index}`, tests: [{ projectName: 'chromium-desktop', ...scenario }] })) }] }], errors: [{ message: 'Servidor indisponível' }] });
    assert.deepEqual(rows.map(row => row.actual), ['OK', 'NAO', 'NAO EXECUTADO', 'OK', 'NAO', 'OK', 'NAO EXECUTADO', 'NAO EXECUTADO']);
    assert.equal(rows[3].state, 'flaky');
    assert.equal(rows[4].expected, 'NAO');
    assert.equal(rows[5].expected, 'NAO');
    assert.equal(rows[1].error, 'falhou');
    assert.equal(rows[0].project, 'chromium-desktop');
    assert.equal(rows[0].file, 'tests/browser/a.ts');
    assert.equal(rows[7].state, 'infrastructure-error');
    assert.throws(() => normalizePlaywright({}), /suites/);
});

test('CLI accepts repeated filters without shell parsing and rejects unknown flags', () => {
    assert.deepEqual(parseArgs(['--jest-pattern=foo bar', '--jest-pattern=x', '--pw-file=a.ts', '--project=webkit-desktop', '--pw-config=custom.ts']), {
        jestPatterns: ['foo bar', 'x'], pwFiles: ['a.ts'], projects: ['webkit-desktop'], pwConfig: 'custom.ts',
    });
    assert.equal(parseArgs(['--help']).help, true);
    assert.throws(() => parseArgs(['--project=']), /inválido/);
    assert.throws(() => parseArgs(['--other=value']), /desconhecido/);
});
