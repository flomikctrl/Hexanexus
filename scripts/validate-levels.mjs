import {createServer} from 'vite';
import {mkdir,writeFile} from 'node:fs/promises';
const server=await createServer({server:{middlewareMode:true},appType:'custom',optimizeDeps:{noDiscovery:true,include:[]}});
try{const {validateCampaign}=await server.ssrLoadModule('/src/level-validation.ts');const report=validateCampaign();console.table(report.map(({number,name,fixed,limit,solution})=>({number,name,fixed,limit,moves:solution.length,valid:true})));await mkdir('artifacts',{recursive:true});await writeFile('artifacts/levels-validation.json',JSON.stringify(report,null,2));}finally{await server.close();}
