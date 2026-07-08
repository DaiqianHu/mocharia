import { defineConfig } from 'vite';

// Plain Vite config: no framework, just an HTML entry that pulls in the
// ES-module game code under /src. `root` defaults to the project directory,
// so `index.html` is the dev/build entry point.
export default defineConfig({
  // GitHub Pages serves this project from https://<user>.github.io/mocharia/,
  // so built asset URLs need the repo name as a base path.
  base: process.env.GITHUB_PAGES ? '/mocharia/' : '/',
  server: {
    open: true,
  },
  // baked in at build time so the title screen can show which deploy is
  // actually live on GitHub Pages (cache-busting is otherwise invisible).
  // __RELAY_URL__ points the co-op client at the room relay: the deployed
  // Cloudflare Worker in production (set RELAY_URL in the build env),
  // falling back to the local node stub (test/relay.mjs) for dev/tests.
  define: {
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    __RELAY_URL__: JSON.stringify(process.env.RELAY_URL || 'ws://localhost:8787'),
  },
});
