import { defineConfig } from '@playwright/test';

// These tests start their own Next server and use a separately provisioned local API.
export default defineConfig({
    testDir: './tests/e2e',
    testMatch: ['controller-contracts.spec.mjs', 'http-contracts.spec.mjs', 'user-actions.spec.mjs', 'profile-actions.spec.mjs', 'vehicle-user-actions.spec.mjs', 'billing-user-actions.spec.mjs', 'medical-user-actions.spec.mjs', 'membership-activation.spec.mjs'],
    workers: 1,
    retries: 0,
    timeout: 60_000,
    reporter: [['list'], ['html', { outputFolder: 'tests/docs/contracts/playwright-report', open: 'never' }],
        ['json', { outputFile: 'tests/docs/contracts/playwright.json' }]],
    outputDir: process.env.TEST_DOCS_OUTPUT ? `${process.env.TEST_DOCS_OUTPUT}/test-results` : 'tests/docs/contracts/test-results',
    use: { trace: 'retain-on-failure', screenshot: 'only-on-failure' },
});
