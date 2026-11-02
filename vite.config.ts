import {defineConfig} from 'vite';
export default defineConfig({server:{watch:{ignored:['**/.tools/**','**/android/**','**/release/**','**/artifacts/**']}},build:{rollupOptions:{output:{manualChunks:{three:['three']}}}}});
