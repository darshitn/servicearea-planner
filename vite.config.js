import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    server: {
      proxy: { '/api': 'http://127.0.0.1:' + (process.env.PORT || env.PORT || '4000') }
    },
    esbuild: { jsx: 'automatic' }
  };
});
