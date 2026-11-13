import {defineConfig} from 'vite';
import {readFileSync} from 'node:fs';
const version=JSON.parse(readFileSync(new URL('./package.json',import.meta.url),'utf8')).version;
export default defineConfig({define:{'import.meta.env.VITE_APP_VERSION':JSON.stringify(version)},server:{watch:{ignored:['**/.tools/**','**/android/**','**/release/**','**/artifacts/**']}},build:{rollupOptions:{output:{manualChunks:{three:['three']}}}}});
