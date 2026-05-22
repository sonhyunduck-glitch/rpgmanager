import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'

/** 빌드 시 version.ts에서 버전 읽어 version.json 자동 생성 */
function versionJsonPlugin() {
  return {
    name: 'version-json',
    buildStart() {
      const versionFile = readFileSync(resolve(__dirname, 'src/lib/version.ts'), 'utf-8');
      const vMatch = versionFile.match(/APP_VERSION\s*=\s*['"]([^'"]+)['"]/);
      const eMatch = versionFile.match(/APP_EPOCH\s*=\s*(\d+)/);
      if (vMatch && eMatch) {
        const json = JSON.stringify({ version: vMatch[1], epoch: parseInt(eMatch[1]) });
        writeFileSync(resolve(__dirname, 'public/version.json'), json);
      }
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [versionJsonPlugin(), react()],
  server: {
    port: Number(process.env.PORT) || 5173,
    host: true,
    strictPort: false,
  },
})
