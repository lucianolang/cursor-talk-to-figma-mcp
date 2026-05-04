import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    figma: 'src/figma_cli/cli.ts',
  },
  format: ['cjs'],
  dts: true,
  clean: true,
  outDir: 'dist',
  target: 'node18',
  sourcemap: true,
  minify: false,
  splitting: false,
  bundle: true,
  noExternal: ['ws'],
  platform: 'node',
  outExtension: () => ({ js: '.cjs' }),
});
