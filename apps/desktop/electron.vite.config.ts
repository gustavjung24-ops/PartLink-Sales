import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import { resolve } from "node:path";

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        "@": resolve(__dirname, "src")
      }
    },
    build: {
      outDir: "dist/main",
      rollupOptions: {
        input: {
          index: resolve(__dirname, "src/main/index.ts")
        }
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        "@": resolve(__dirname, "src")
      }
    },
    build: {
      outDir: "dist/preload",
      rollupOptions: {
        input: {
          index: resolve(__dirname, "src/preload/index.ts")
        }
      }
    }
  },
  renderer: {
    root: ".",
    resolve: {
      alias: {
        "@": resolve(__dirname, "src")
      }
    },
    build: {
      outDir: "dist/renderer",
      rollupOptions: {
        input: {
          index: resolve(__dirname, "index.html")
        }
      }
    },
    server: {
      port: 5173,
      strictPort: false
    }
  }
});
