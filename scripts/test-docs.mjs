import { spawn, spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const columns = ['Tela', 'Erro simulado', 'Resposta esperada', 'Resultado', 'Quem fez (autor do commit)', 'Quando executado (ISO)', 'Caso técnico', 'Motor', 'Projeto', 'Arquivo', 'Detalhes da falha', 'Quando commit (ISO)', 'Commit', 'Árvore com alterações'];

/** Quote every field and neutralize spreadsheet formulas, including leading whitespace. */
export function csvField(value) {
    let text = String(value ?? '').replace(/\u0000/g, '');
    if (/^[\s\uFEFF]*[=+@-]/u.test(text)) text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
}

export function toCsv(rows, context = {}) {
    return '\uFEFF' + [columns, ...rows.filter(row => row.documented || row.state === 'infrastructure-error').map(row => [
        row.screen, row.simulatedError, row.response, row.actual,
        context.author, context.executedAt, row.title, row.engine, row.project,
        relativeTestPath(row.file, row.engine), row.error, context.commitDate, context.commit, context.dirty,
    ])].map(fields => fields.map(csvField).join(';')).join('\r\n') + '\r\n';
}

function errorText(value) {
    if (Array.isArray(value)) return value.map(errorText).filter(Boolean).join('\n');
    if (value && typeof value === 'object') return value.message ?? value.stack ?? JSON.stringify(value);
    return String(value ?? '');
}

export function relativeTestPath(file, engine) {
    if (!file) return '';
    const normalized = String(file).replaceAll('\\', '/');
    const marker = normalized.toLowerCase().lastIndexOf('/tests/');
    if (marker >= 0) return normalized.slice(marker);
    return normalized.startsWith('tests/') ? `/${normalized}` : path.isAbsolute(file) || /^[A-Za-z]:\//.test(normalized) ? '' : engine === 'Playwright' ? `/tests/browser/${normalized}` : normalized;
}

function decorate(row, cases) {
    const metadata = cases.find(entry => typeof entry.match === 'string' && row.title.includes(entry.match) && (!entry.engine || entry.engine === row.engine));
    return { ...row, documented: Boolean(metadata), screen: metadata?.screen ?? 'Execução dos testes',
        simulatedError: metadata?.error ?? 'Falha na execução dos testes',
        response: metadata?.response ?? 'Os testes devem ser executados e seus resultados registrados.' };
}

export function normalizeJest(report, cases = []) {
    if (!Array.isArray(report?.testResults)) throw new Error('Relatório Jest sem testResults.');
    const rows = [];
    for (const suite of report.testResults) {
        const assertions = suite.assertionResults ?? [];
        for (const assertion of assertions) {
            const status = assertion.status;
            const nonexecuted = ['pending', 'todo', 'skipped', 'disabled'].includes(status);
            rows.push(decorate({ engine: 'Jest', project: '', file: suite.name ?? '',
                title: assertion.fullName ?? [...(assertion.ancestorTitles ?? []), assertion.title].join(' '),
                expected: assertion.failing ? 'NAO' : 'OK',
                actual: nonexecuted ? 'NAO EXECUTADO' : assertion.failing ? (status === 'passed' ? 'NAO' : 'OK') : status === 'passed' ? 'OK' : 'NAO',
                state: status ?? 'unknown', error: errorText(assertion.failureMessages) }, cases));
        }
        // Compilation/setup failures may produce a suite without any collected assertions.
        if (!assertions.length || suite.status === 'failed' && !assertions.some(item => item.status === 'failed')) {
            rows.push(decorate({ engine: 'Jest', project: '', file: suite.name ?? '', title: 'Suíte não coletada ou falha de infraestrutura',
                expected: 'OK', actual: 'NAO EXECUTADO', state: suite.status ?? 'uncollected',
                error: errorText(suite.message) || 'Nenhum cenário executável coletado.' }, cases));
        }
    }
    return rows;
}

export function normalizePlaywright(report, cases = []) {
    if (!Array.isArray(report?.suites)) throw new Error('Relatório Playwright sem suites.');
    const rows = [];
    function visit(suite, parents = [], parentFile = '') {
        const titles = [...parents, suite.title].filter(Boolean);
        const file = suite.file ?? parentFile;
        for (const spec of suite.specs ?? []) for (const test of spec.tests ?? []) {
            const results = test.results ?? [];
            const last = results.at(-1);
            const nonexecuted = !last || ['skipped', 'interrupted'].includes(last.status);
            const expectedFailed = test.expectedStatus === 'failed';
            const specFile = spec.file ?? file;
            const reportFile = specFile && report.config?.rootDir && !path.isAbsolute(specFile) ? path.join(report.config.rootDir, specFile) : specFile;
            rows.push(decorate({ engine: 'Playwright', project: test.projectName ?? test.projectId ?? '', file: reportFile,
                title: [...titles, spec.title].join(' › '), expected: expectedFailed ? 'NAO' : 'OK',
                actual: nonexecuted ? 'NAO EXECUTADO' : last.status === 'passed' ? 'OK' : 'NAO',
                state: test.status ?? last?.status ?? 'not-run',
                error: results.map(result => errorText(result.errors ?? result.error)).filter(Boolean).join('\n') }, cases));
        }
        for (const child of suite.suites ?? []) visit(child, titles, file);
    }
    report.suites.forEach(suite => visit(suite));
    for (const error of report.errors ?? []) rows.push(decorate({ engine: 'Playwright', project: '', file: '',
        title: 'Falha global de infraestrutura', expected: 'OK', actual: 'NAO EXECUTADO', state: 'infrastructure-error', error: errorText(error) }, cases));
    return rows;
}

export function parseArgs(args) {
    const options = { jestPatterns: [], pwFiles: [], projects: [] };
    for (const arg of args) {
        if (arg === '--help' || arg === '-h') { options.help = true; continue; }
        const separator = arg.indexOf('=');
        const key = arg.slice(0, separator), value = arg.slice(separator + 1);
        if (separator < 0 || !value) throw new Error(`Argumento inválido: ${arg}`);
        if (key === '--jest-pattern') options.jestPatterns.push(value);
        else if (key === '--pw-file') options.pwFiles.push(value);
        else if (key === '--project') options.projects.push(value);
        else if (key === '--pw-config') options.pwConfig = value;
        else throw new Error(`Argumento desconhecido: ${key}`);
    }
    return options;
}

function git(args) {
    const result = spawnSync('git', ['-c', `safe.directory=${root.replaceAll('\\', '/')}`, ...args], { cwd: root, encoding: 'utf8', shell: false });
    if (result.error || result.status !== 0) throw new Error(result.error?.message ?? result.stderr.trim());
    return result.stdout.trim();
}

async function execute(cli, args, env) {
    return new Promise(resolve => {
        const child = spawn(process.execPath, [cli, ...args], { cwd: root, env: { ...process.env, ...env }, stdio: 'inherit', shell: false });
        child.once('error', error => resolve({ code: 1, error: error.message }));
        child.once('close', (code, signal) => resolve({ code: code ?? 1, error: signal ? `Encerrado por ${signal}` : '' }));
    });
}

/** Each invocation keeps runner reports and coverage together in a new directory. */
export async function main(args = process.argv.slice(2)) {
    const options = parseArgs(args);
    if (options.help) {
        console.log('Uso: npm run test:docs -- [--jest-pattern=expressão] [--pw-file=arquivo] [--pw-config=arquivo] [--project=nome]\nFiltros jest-pattern, pw-file e project podem ser repetidos. Sem filtros: Jest completo com coverage e Playwright completo.\nCSV, JSON, cobertura Jest e HTML Playwright ficam juntos em tests/docs.\nQuem fez identifica o autor do commit HEAD, nunca o executor dos testes.');
        return 0;
    }
    const executedAt = new Date().toISOString();
    const directory = path.join(root, 'tests', 'docs', `${executedAt.replaceAll(':', '-')}-${randomUUID()}`);
    await mkdir(directory, { recursive: true });
    const context = { executedAt, author: 'Não disponível', commitDate: 'Não disponível', commit: 'Não disponível', dirty: 'Não disponível' };
    const rows = [];
    let failed = false;
    const infrastructure = (engine, error) => {
        failed = true;
        rows.push(decorate({ engine, title: 'Falha de execução ou relatório ausente', project: '', file: '', expected: 'OK', actual: 'NAO EXECUTADO', state: 'infrastructure-error', error: errorText(error) }, []));
    };
    try {
        const [commit, author, commitDate] = git(['show', '-s', '--format=%H%n%an <%ae>%n%aI', 'HEAD']).split('\n');
        Object.assign(context, { commit, author, commitDate, dirty: git(['status', '--porcelain', '--untracked-files=normal']) ? 'SIM' : 'NAO' });
    } catch (error) { infrastructure('Git', error); }
    let cases = [];
    try {
        const metadata = JSON.parse((await readFile(path.join(root, 'tests', 'test-docs-cases.json'), 'utf8')).replace(/^\uFEFF/, ''));
        if (!Array.isArray(metadata)) throw new Error('Metadados devem ser um array.');
        cases = metadata;
    } catch (error) { if (error.code !== 'ENOENT') infrastructure('Metadados', error); }
    const jobs = [
        { name: 'Jest', cli: 'node_modules/jest/bin/jest.js', file: path.join(directory, 'jest.json'), normalize: normalizeJest,
            args: ['--runInBand', '--coverage', `--coverageDirectory=${path.join(directory, 'coverage')}`, '--json', `--outputFile=${path.join(directory, 'jest.json')}`, ...options.jestPatterns.map(value => `--testPathPatterns=${value}`)] },
        { name: 'Playwright', cli: 'node_modules/@playwright/test/cli.js', file: path.join(directory, 'playwright.json'), normalize: normalizePlaywright,
            args: ['test', ...options.pwFiles, ...(options.pwConfig ? [`--config=${options.pwConfig}`] : []), ...options.projects.map(value => `--project=${value}`), '--reporter=list,html,json'],
            env: { PLAYWRIGHT_JSON_OUTPUT_FILE: path.join(directory, 'playwright.json'), PLAYWRIGHT_HTML_OUTPUT_DIR: path.join(directory, 'playwright-report'), PLAYWRIGHT_HTML_OPEN: 'never' } },
    ];
    try {
        for (const job of jobs) {
            const result = await execute(path.join(root, job.cli), job.args, job.env);
            if (result.code !== 0) infrastructure(job.name, result.error || `Runner finalizou com código ${result.code}.`);
            try {
                const report = JSON.parse(await readFile(job.file, 'utf8'));
                const normalized = job.normalize(report, cases);
                rows.push(...normalized);
                if (!normalized.length) infrastructure(job.name, 'Nenhum cenário coletado no relatório desta execução.');
                if (normalized.some(row => row.actual === 'NAO EXECUTADO' || ['flaky', 'unexpected'].includes(row.state) || row.actual !== row.expected)) failed = true;
            } catch (error) { infrastructure(job.name, error); }
        }
    } catch (error) { infrastructure('Runner', error); }
    finally {
        await writeFile(path.join(directory, 'resultados.csv'), toCsv(rows, context), 'utf8');
        await writeFile(path.join(directory, 'execucao.json'), JSON.stringify({ ...context, authorMeaning: 'Autor do commit HEAD; não identifica quem executou os testes.', failed, rows: rows.length }, null, 2), 'utf8');
        console.log(`Relatórios desta execução: ${directory}`);
    }
    return failed ? 1 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    main().then(code => { process.exitCode = code; }).catch(error => { console.error(error); process.exitCode = 1; });
}
