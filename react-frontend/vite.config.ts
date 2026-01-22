import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { visualizer } from "rollup-plugin-visualizer";
import compression from "vite-plugin-compression";
import { readFile, writeFile } from 'fs/promises';

// Plugin para normalizar rutas de módulos en Windows y evitar paths absolutos en el visualizer
function normalizeModuleIds() {
  return {
    name: 'normalize-module-ids',
    generateBundle(_options: unknown, bundle: Record<string, unknown>) {
      const prefixWin = `${process.cwd().replace(/\\/g, '/').replace(/\/$/, '')}/`;
      for (const fileName of Object.keys(bundle)) {
        const chunk = bundle[fileName] as unknown;
        // describe minimal shape we need from the rollup chunk
        const chunkObj = chunk as { type?: string; modules?: Record<string, unknown> };
        if (chunkObj && chunkObj.type === 'chunk' && chunkObj.modules) {
          const newModules: Record<string, unknown> = {};
          const modules = chunkObj.modules as Record<string, unknown>;
          for (const id of Object.keys(modules)) {
            let newId = String(id).replaceAll('\\', '/');
            if (newId.startsWith(prefixWin)) newId = newId.slice(prefixWin.length);
            // also remove leading drive letter patterns like C:/...
            newId = newId.replace(/^[A-Za-z]:\//, '');
            newModules[newId] = modules[id as string];
          }
          // replace modules map
          // replace modules map using Reflect to avoid `any` casts
          Reflect.set(chunkObj, 'modules', newModules);
        }
      }
    }
  };
}

// Plugin que limpia `dist/stats.html` tras escritura para asegurar rutas relativas
function sanitizeStatsAfterWrite() {
  return {
    name: 'sanitize-stats-after-write',
    async writeBundle() {
      try {
        const file = path.resolve(__dirname, 'dist', 'stats.html');
        let s = await readFile(file, 'utf8');
        // Reemplazos seguros: sólo quitar apariciones absolutas del cwd
        const cwd = process.cwd();
        const cwdForward = cwd.replace(/\\/g, '/');
        const cwdEscaped = cwd.replace(/\\/g, '\\\\');

        // Reemplazar variantes exactas (con y sin barras) y prefijos de rollup ('\\u0000')
        s = s.split(cwd).join('');
        s = s.split(cwdForward).join('');
        s = s.split('\\u0000' + cwd).join('');
        s = s.split('\\u0000' + cwdForward).join('');

        // También reemplazar la versión con backslashes escapados (por si aparece en literales)
        s = s.split(cwdEscaped).join('');

          await writeFile(file, s, 'utf8');
          console.log('sanitize: stats.html actualizado con rutas relativas (saneado seguro)')
        } catch {
          // ignore
        }
    }
  }
}

export default defineConfig({
  // Usar rutas relativas en el build para que `index.html` cargue assets
  // correctamente cuando el sitio no se sirve desde la raíz del dominio.
  base: "./",
  plugins: [
    react(),
    // normalizar rutas y luego genera dist/stats.html con análisis del bundle
    normalizeModuleIds(),
    visualizer({ filename: "dist/stats.html", gzipSize: true, brotliSize: true }),
    sanitizeStatsAfterWrite(),
    // generar .gz y .br para servir en producción (reduce transferencia)
    compression({ algorithm: "gzip" }),
    compression({ algorithm: "brotliCompress", ext: ".br" }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@shared": path.resolve(__dirname, "./src/shared"),
      react: path.resolve(__dirname, "node_modules/react"),
      "react-dom": path.resolve(__dirname, "node_modules/react-dom"),
    },
    dedupe: ["react", "react-dom"],
  },
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return undefined;
          // Group most node_modules into a single 'vendor' chunk to avoid
          // circular runtime dependencies between separate vendor chunks
          // (React + other libraries). Keep a couple of very large libs
          // in their own chunks for caching, but otherwise return 'vendor'.
          const xlsx = /node_modules[\\/]xlsx[\\/]/;
          const tanstack = /node_modules[\\/]@tanstack[\\/]/;
          const jspdf = /node_modules[\\/]jspdf[\\/]/;
          const lucide = /node_modules[\\/]lucide-react[\\/]/;
          if (xlsx.test(id)) return 'xlsx';
          if (tanstack.test(id)) return 'tanstack-vendor';
          if (jspdf.test(id)) return 'jspdf';
          if (lucide.test(id)) return 'icons-vendor';
          return 'vendor';
        }
      }
    }
  }
});
