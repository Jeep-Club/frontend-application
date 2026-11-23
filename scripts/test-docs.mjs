import { spawn, spawnSync } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const columns = ['Tela', 'Ação do usuário', 'Erro simulado', 'Resposta esperada', 'Resultado', 'Quando executado (ISO)', 'Caso técnico', 'Motor', 'Projeto', 'Arquivo', 'Detalhes da falha ou lacuna', 'Fonte da ação', 'Função', 'Quem fez (autor do commit)', 'Quando commit (ISO)', 'Commit', 'Árvore com alterações'];

/** Quote every field and neutralize spreadsheet formulas, including leading whitespace. */
export function csvField(value) {
    let text = String(value ?? '').replace(/\u0000/g, '');
    if (/^[\s\uFEFF]*[=+@-]/u.test(text)) text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
}

export function toCsv(rows, context = {}) {
    return '\uFEFF' + [columns, ...rows.filter(row => row.documented || row.state === 'infrastructure-error').map(row => [
        row.screen, row.action, row.simulatedError, row.response, row.actual,
        context.executedAt, row.title, row.engine, row.project,
        relativeTestPath(row.file, row.engine), portableText(row.error), row.source, row.exportName,
        context.author, context.commitDate, context.commit, context.dirty,
    ])].map(fields => fields.map(csvField).join(';')).join('\r\n') + '\r\n';
}

function portableText(value) {
    return String(value ?? '').replaceAll(root, '').replaceAll(root.replaceAll('\\', '/'), '');
}

/** Missing UI evidence remains visible for every inventoried action/scenario. */
export function reconcileActions(inventory, rows) {
    return inventory.flatMap(action => action.scenarios.map(scenario => {
        const evidence = rows.filter(row => row.engine === 'Playwright' && (
            (row.source === action.source && row.exportName === action.exportName && row.simulatedError === scenario.error && (!action.variant || row.actionId === action.id || row.variant === action.variant))
            || (scenario.match && row.title.includes(scenario.match))));
        const base = { screen: action.screen, action: action.action, source: action.source, exportName: action.exportName,
            simulatedError: scenario.error, response: scenario.response, documented: true };
        if (!evidence.length) return { ...base, actual: 'NAO EXECUTADO', state: 'not-covered', title: action.id,
            engine: 'Playwright', project: '', file: '', error: action.consumer ? 'Sem evidência E2E deste cenário nesta execução.' : 'Sem consumidor de interface identificado para esta função.' };
        return { ...base, actual: evidence.some(row => row.actual === 'NAO') ? 'NAO' : evidence.some(row => row.actual === 'NAO EXECUTADO') ? 'NAO EXECUTADO' : 'OK',
            state: evidence.some(row => row.state === 'flaky') ? 'flaky' : 'executed', engine: 'Playwright',
            title: evidence.map(row => row.title).join('\n'), project: [...new Set(evidence.map(row => row.project))].join(', '),
            file: evidence[0].file, error: evidence.map(row => row.error).filter(Boolean).join('\n') };
    }));
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
    return { ...row, action: metadata?.action, source: metadata?.source, exportName: metadata?.exportName,
        documented: Boolean(metadata), screen: metadata?.screen ?? 'Execução dos testes',
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
            const row = decorate({ engine: 'Playwright', project: test.projectName ?? test.projectId ?? '', file: reportFile,
                title: [...titles, spec.title].join(' › '), expected: expectedFailed ? 'NAO' : 'OK',
                actual: nonexecuted ? 'NAO EXECUTADO' : last.status === 'passed' ? 'OK' : 'NAO',
                state: test.status ?? last?.status ?? 'not-run',
                error: results.map(result => errorText(result.errors ?? result.error)).filter(Boolean).join('\n') }, cases);
            const annotations = [...new Map([...(test.annotations ?? []), ...(last?.annotations ?? [])].filter(item => item.type === 'user-action').map(item => [item.description, item])).values()];
            if (!annotations.length) rows.push(row);
            else for (const annotation of annotations) {
                const metadata = JSON.parse(annotation.description);
                rows.push({ ...row, ...metadata, simulatedError: metadata.error, error: row.error, documented: true });
            }
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

async function execute(cli, args, env, logFile) {
    return new Promise(resolve => {
        const log = createWriteStream(logFile);
        const child = spawn(process.execPath, [cli, ...args], { cwd: root, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true, shell: false });
        child.stdout.pipe(log, { end: false }); child.stderr.pipe(log, { end: false });
        child.once('error', error => { log.end(error.message); resolve({ code: 1, error: error.message }); });
        child.once('close', (code, signal) => { log.end(); resolve({ code: code ?? 1, error: signal ? `Encerrado por ${signal}` : '' }); });
    });
}

const html = value => portableText(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
function resultsHtml(title, rows, links = '') {
    return `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>${html(title)}</title><style>body{font:16px system-ui;margin:2rem;color:#17212b}table{border-collapse:collapse;width:100%}td,th{text-align:left;border:1px solid #ccd4db;padding:.5rem;vertical-align:top}pre{white-space:pre-wrap}a{color:#075bb2}</style><h1>${html(title)}</h1>${links}<p>${rows.length} registros; ${rows.filter(row => row.actual === 'OK').length} OK; ${rows.filter(row => row.actual === 'NAO').length} falhas; ${rows.filter(row => row.actual === 'NAO EXECUTADO').length} não executados.</p><table><thead><tr><th>Tela / Caso</th><th>Ação / Cenário</th><th>Resposta esperada</th><th>Resultado</th><th>Detalhes</th></tr></thead><tbody>${rows.map(row => `<tr><td>${html(row.screen || row.title)}</td><td>${html(row.action || row.title)}<br>${html(row.simulatedError || '')}</td><td>${html(row.response || '')}</td><td>${html(row.actual)}</td><td><pre>${html(row.error || '')}</pre></td></tr>`).join('')}</tbody></table></html>`;
}

/** One shared read-only story server; each browser group owns its Next/API ports. */
async function startStorybook(directory) {
    const url = new URL(process.env.PLAYWRIGHT_STORYBOOK_URL || 'http://127.0.0.1:6106');
    if (!['localhost', '127.0.0.1'].includes(url.hostname)) throw new Error('Storybook de testes deve ser local.');
    try { await fetch(new URL('/index.json', url), { signal: AbortSignal.timeout(1000) }); throw new Error('Porta Storybook ocupada; selecione uma origem local exclusiva.'); }
    catch (error) { if (error.message.startsWith('Porta Storybook')) throw error; }
    const log = createWriteStream(path.join(directory, 'storybook.log'));
    const child = spawn(process.execPath, [path.join(root, 'node_modules/storybook/dist/bin/dispatcher.js'), 'dev', '--host', url.hostname, '--port', url.port, '--ci', '--no-open', '--disable-telemetry'], { cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, STORYBOOK_URL: url.origin } });
    child.stdout.pipe(log, { end: false }); child.stderr.pipe(log, { end: false });
    child.on('error', error => log.write(error.message));
    const stop = () => { if (child.exitCode === null) child.kill(); log.end(); };
    try {
        const deadline = Date.now() + 180000;
        while (Date.now() < deadline) {
            if (child.exitCode !== null) throw new Error(`Storybook encerrou com ${child.exitCode}; consulte storybook.log.`);
            try { if ((await fetch(new URL('/index.json', url), { signal: AbortSignal.timeout(2000) })).ok) return stop; } catch { /* Still starting. */ }
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        throw new Error('Storybook não ficou pronto em 180 segundos.');
    } catch (error) { stop(); throw error; }
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
    await mkdir(path.join(directory, 'jest'), { recursive: true });
    const context = { executedAt, author: 'Não disponível', commitDate: 'Não disponível', commit: 'Não disponível', dirty: 'Não disponível' };
    const rows = [], executions = [];
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
    const jobs = [{ name: 'Jest', cli: 'node_modules/jest/bin/jest.js', file: path.join(directory, 'jest', 'resultados.json'), normalize: normalizeJest,
        args: ['--runInBand', '--coverage', `--coverageDirectory=${path.join(directory, 'jest', 'coverage')}`, '--coverageReporters=text', '--coverageReporters=lcov', '--coverageReporters=html', '--coverageReporters=json', '--coverageReporters=json-summary', '--coverageReporters=cobertura', '--json', `--outputFile=${path.join(directory, 'jest', 'resultados.json')}`, ...options.jestPatterns.map(value => `--testPathPatterns=${value}`)] }];
    const plans = options.pwConfig ? [{ config: options.pwConfig, projects: options.projects }] : [
        ...['chromium-*', 'firefox-*', 'webkit-*', 'a11y-*'].map((project, index) => {
            const app = new URL(process.env.PLAYWRIGHT_APP_URL || 'http://127.0.0.1:3100');
            const api = new URL(process.env.PLAYWRIGHT_API_URL || 'http://127.0.0.1:3101');
            app.port = String(Number(app.port) + index * 20); api.port = String(Number(api.port) + index * 20);
            return { config: 'playwright.config.ts', projects: [project], browser: true,
                env: { PLAYWRIGHT_APP_URL: app.origin, PLAYWRIGHT_API_URL: api.origin, JEEP_PLAYWRIGHT_ID: `group-${index}`, PLAYWRIGHT_EXTERNAL_STORYBOOK: '1' } };
        }), { config: 'playwright.contracts.config.ts', projects: [] },
    ];
    for (const [index, plan] of plans.entries()) {
        const { config } = plan;
        const output = path.join(directory, `playwright-${index + 1}`);
        await mkdir(output, { recursive: true });
        jobs.push({ name: `Playwright (${config} ${plan.projects.join(' ')})`, browser: plan.browser, cli: 'node_modules/@playwright/test/cli.js', file: path.join(output, 'resultados.json'), normalize: normalizePlaywright,
            args: ['test', ...options.pwFiles, `--config=${config}`, ...plan.projects.map(value => `--project=${value}`), `--output=${path.join(output, 'test-results')}`, '--reporter=list,html,json'],
            env: { PLAYWRIGHT_APP_URL: process.env.PLAYWRIGHT_APP_URL || 'http://127.0.0.1:3100', PLAYWRIGHT_STORYBOOK_URL: process.env.PLAYWRIGHT_STORYBOOK_URL || 'http://127.0.0.1:6106', PLAYWRIGHT_API_URL: process.env.PLAYWRIGHT_API_URL || 'http://127.0.0.1:3101',
                TEST_DOCS_OUTPUT: output, PLAYWRIGHT_JSON_OUTPUT_FILE: path.join(output, 'resultados.json'), PLAYWRIGHT_HTML_OUTPUT_DIR: path.join(output, 'html'), PLAYWRIGHT_HTML_OPEN: 'never', ...plan.env } });
    }
    let stopStorybook;
    try {
        const runJob = async job => {
            console.log(`Executando ${job.name}; log: /${path.relative(root, path.join(path.dirname(job.file), 'runner.log')).replaceAll('\\', '/')}`);
            let result = await execute(path.join(root, job.cli), job.args, job.env, path.join(path.dirname(job.file), 'runner.log'));
            // Next may stop before collecting any test to show its security advisory.
            // Retry only that initialization stop, preserving the first log as evidence.
            const initialLog = await readFile(path.join(path.dirname(job.file), 'runner.log'), 'utf8');
            if (result.code && job.browser && initialLog.includes('Process from config.webServer was not able to start') && (initialLog.includes('SecurityFatalError') || initialLog.includes('Your version of Next.js is affected by a known security vulnerability'))) {
                executions.push({ runner: job.name, initialization: 'Next security advisory stopped webServer before test execution', exitCode: result.code });
                result = await execute(path.join(root, job.cli), job.args, job.env, path.join(path.dirname(job.file), 'runner-after-advisory.log'));
            }
            const execution = { runner: job.name, command: `node ${job.cli} ${job.args.map(portableText).join(' ')}`, exitCode: result.code };
            executions.push(execution);
            if (result.code !== 0) failed = true;
            try {
                const report = JSON.parse(await readFile(job.file, 'utf8'));
                Object.assign(execution, job.name === 'Jest'
                    ? { tests: report.numTotalTests, passed: report.numPassedTests, failed: report.numFailedTests, skipped: report.numPendingTests }
                    : { tests: ['expected', 'unexpected', 'skipped', 'flaky'].reduce((sum, key) => sum + (report.stats?.[key] ?? 0), 0), passed: report.stats?.expected ?? 0, failed: report.stats?.unexpected ?? 0, skipped: report.stats?.skipped ?? 0 });
                const normalized = job.normalize(report, cases);
                rows.push(...normalized);
                console.log(`${job.name}: ${normalized.length} casos, ${normalized.filter(row => row.actual === 'OK').length} OK; código ${result.code}.`);
                if (job.name === 'Jest') await writeFile(path.join(directory, 'jest', 'index.html'), resultsHtml('Resultados Jest', normalized, '<p><a href="coverage/index.html">Cobertura HTML nativa do Jest</a> · <a href="resultados.json">JSON nativo</a> · <a href="runner.log">Log completo</a></p>'));
                if (!normalized.length) infrastructure(job.name, 'Nenhum cenário coletado no relatório desta execução.');
                if (normalized.some(row => row.actual === 'NAO EXECUTADO' || ['flaky', 'unexpected'].includes(row.state) || row.actual !== row.expected)) failed = true;
            } catch (error) { infrastructure(job.name, error); }
        };
        await runJob(jobs[0]);
        if (options.pwConfig) await runJob(jobs[1]);
        else {
            stopStorybook = await startStorybook(directory);
            const browserJobs = jobs.filter(job => job.browser);
            for (let index = 0; index < browserJobs.length; index += 2) await Promise.all(browserJobs.slice(index, index + 2).map(runJob));
            stopStorybook(); stopStorybook = undefined;
            await runJob(jobs.at(-1));
        }
    } catch (error) { infrastructure('Runner', error); }
    finally {
        stopStorybook?.();
        let actionRows = [];
        try {
            const inventory = JSON.parse(await readFile(path.join(root, 'tests', 'user-action-inventory.json'), 'utf8'));
            actionRows = reconcileActions(inventory, rows);
            await writeFile(path.join(directory, 'inventario-acoes.json'), JSON.stringify(inventory, null, 2));
        } catch (error) { infrastructure('Inventário', error); }
        const additional = rows.filter(row => row.documented && !actionRows.some(action => action.title.includes(row.title)) || row.state === 'infrastructure-error');
        const documented = [...actionRows, ...additional];
        if (actionRows.some(row => row.actual !== 'OK')) failed = true;
        await writeFile(path.join(directory, 'resultados.csv'), toCsv(documented, context), 'utf8');
        await writeFile(path.join(directory, 'resultados-completos.json'), JSON.stringify(rows, null, 2));
        await writeFile(path.join(directory, 'execucao.json'), JSON.stringify({ ...context, authorMeaning: 'Autor do commit HEAD; não identifica quem executou os testes.', failed, executions,
            tests: executions.reduce((sum, execution) => sum + (execution.tests ?? 0), 0), evidenceRows: rows.length, actionScenarios: actionRows.length, coveredActionScenarios: actionRows.filter(row => row.actual !== 'NAO EXECUTADO').length,
            missingActionScenarios: actionRows.filter(row => row.actual === 'NAO EXECUTADO').length }, null, 2), 'utf8');
        const links = '<p><a href="resultados.csv">CSV de ações</a> · <a href="jest/index.html">Jest</a> · ' + plans.map((plan, index) => `<a href="playwright-${index + 1}/html/index.html">Playwright ${html(plan.projects.join(', ') || plan.config)}</a>`).join(' · ') + ' · <a href="execucao.json">Execução e limitações</a></p><p>A cobertura Jest é restrita aos utilitários configurados. NAO EXECUTADO identifica lacuna; contrato HTTP e teste unitário não comprovam interação de interface.</p>';
        await writeFile(path.join(directory, 'index.html'), resultsHtml('Ações do usuário — resultados e lacunas', documented, links));
        console.log(`Relatórios desta execução: /${path.relative(root, directory).replaceAll('\\', '/')}`);
    }
    return failed ? 1 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    main().then(code => { process.exitCode = code; }).catch(error => { console.error(error); process.exitCode = 1; });
}
