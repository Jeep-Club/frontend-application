import { defineConfig } from '@playwright/test';

// These tests start their own Next server and use a separately provisioned local API.
export default defineConfig({
    testDir: './tests/e2e',
    testMatch: ['controller-contracts.spec.mjs', 'http-contracts.spec.mjs'],
    workers: 1,
    retries: 0,
    timeout: 60_000,
    reporter: [['list'], ['html', { outputFolder: 'tests/docs/contracts/playwright-report', open: 'never' }],
        ['json', { outputFile: 'tests/docs/contracts/playwright.json' }]],
    outputDir: 'tests/docs/contracts/test-results',
    use: { trace: 'retain-on-failure', screenshot: 'only-on-failure' },
});
