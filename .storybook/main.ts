import type { StorybookConfig } from "@storybook/nextjs-vite";

const config: StorybookConfig = {
  stories: ["./Introduction.mdx", "./docs/*.mdx", "../src/components/**/*.mdx", "../src/components/**/*.stories.tsx"],
  addons: ["@storybook/addon-docs"],
  framework: "@storybook/nextjs-vite",
  staticDirs: ["../public"],
  // Test evidence is written while browsers use Storybook. Watching those HTML
  // files reloads the iframe mid-interaction and invalidates the test session.
  viteFinal: async (viteConfig) => ({
    ...viteConfig,
    server: {
      ...viteConfig.server,
      watch: {
        ...viteConfig.server?.watch,
        ignored: ['**/tests/docs/**', '**/test-results*/**', '**/.next*/**', '**/coverage/**', '**/*.log'],
      },
    },
  }),
};

export default config;
