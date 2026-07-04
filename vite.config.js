import { defineConfig } from 'vite';

// Plain Vite config: no framework, just an HTML entry that pulls in the
// ES-module game code under /src. `root` defaults to the project directory,
// so `index.html` is the dev/build entry point.
export default defineConfig({
  server: {
    open: true,
  },
});
