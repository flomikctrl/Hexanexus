import {createServer} from 'vite';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const server=await createServer({server:{middlewareMode:true},appType:'custom'});
try{
 const {levels:first}=await server.ssrLoadModule('/src/levels.ts'),{secondLevels:second}=await server.ssrLoadModule('/src/levels-second.ts'),{Puzzle}=await server.ssrLoadModule('/src/state.ts'),{project}=await server.ssrLoadModule('/src/projections.ts');
 const levels=[...first,...second];
 const {findHintPath,hintSnapshot,replayHints,HintChain}=await server.ssrLoadModule('/src/hint-path.ts');
 const report=[];
 for(let index=0;index<levels.length;index++)for(const scenario of ['initial','wrong-prefix','wrong-full','mixed']){
  const p=new Puzzle(levels[index]);
  if(scenario!=='initial'){
   const limit=scenario==='wrong-prefix'?Math.min(3,p.level.limit):p.level.limit;
   while(p.placed.length<limit){const wrong=p.level.available.filter(cell=>p.canPlace(cell)&&project([cell],p.orientation,p.size).some((mask,s)=>mask.some((v,i)=>v&&!p.level.targets[s][i]))),legal=p.level.available.filter(cell=>p.canPlace(cell));const choices=wrong.length?wrong:legal;if(!choices.length)break;p.place(choices[(index+p.placed.length)%choices.length]);}
   if(scenario==='mixed'){const removable=p.placed.filter(cell=>p.canRemove(cell));if(removable.length)p.remove(removable[0]);}
  }
  const before=JSON.stringify(p),start=performance.now(),result=findHintPath(hintSnapshot(p)),ms=performance.now()-start;
  assert(['found','solved'].includes(result.status),`No path: level ${index+1}, ${scenario}, ${JSON.stringify(result)}`);assert(replayHints(hintSnapshot(p),result.steps)?.won,'Invalid solution');
  const chain=new HintChain();assert(chain.set(p,result.steps));let shown=0;while(chain.next())shown++;assert.equal(shown,result.steps.length);assert.equal(JSON.stringify(p),before,'Virtual hints changed real board');
  report.push({campaign:p.size===4?'second':'first',name:p.level.name,number:index%30+1,scenario,placed:p.placed.length,steps:result.steps.length,expanded:result.expanded,fallback:result.fallback,ms:Number(ms.toFixed(2))});
 }
 await mkdir('artifacts',{recursive:true});await writeFile('artifacts/hints-validation.json',JSON.stringify({levels:levels.length,states:report.length,maxMs:Math.max(...report.map(r=>r.ms)),maxExpanded:Math.max(...report.map(r=>r.expanded)),fallbacks:report.filter(r=>r.fallback).length,report},null,2));
 console.log(JSON.stringify({levels:levels.length,states:report.length,maxMs:Math.max(...report.map(r=>r.ms)),maxExpanded:Math.max(...report.map(r=>r.expanded)),fallbacks:report.filter(r=>r.fallback).length}));
}finally{await server.close();}
