import {createServer} from 'vite';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const server=await createServer({server:{middlewareMode:true},appType:'custom'});
try{
 const {ArcadeSession,readArcadeSave}=await server.ssrLoadModule('/src/arcade.ts');
 const {legalOperations,taskGroups,projectionKey,shapeKey}=await server.ssrLoadModule('/src/arcade-generator.ts');
 const {matches}=await server.ssrLoadModule('/src/projections.ts');
 const {connected,inGrid}=await server.ssrLoadModule('/src/connectivity.ts');
 const reports=[];
 for(const seed of [7,42,20261113]){
  const storage={data:new Map(),getItem(k){return this.data.get(k)??null},setItem(k,v){this.data.set(k,v)}};
  const session=ArcadeSession.create(seed,storage,()=>0);session.resume();
  const report={seed,rounds:10000,additions:0,removals:0,repeatedPairsLast20:0,avoidableRepeatedPairs:0,repeatedStatesLast20:0,immediateReturns:0,fourMoveReturns:0,threeStateOscillations:0,alternativeSolutions:0,minCubes:27,maxCubes:0,uniquePairs:0,uniqueStates:0,restores:0};
  const signatures=new Set(),shapes=new Set(),start=performance.now();
  for(let round=0;round<report.rounds;round++){
   const s=session.state,signature=projectionKey(s.targets),groups=taskGroups(s.fixed,session.puzzle.placed);
   assert(!matches(session.puzzle.projections,s.targets),'Already solved target');
   const choices=legalOperations(s.fixed,session.puzzle.placed).filter(op=>matches(op.targets,s.targets));assert(choices.length>0,'No single-action solution');
   const repeated=s.history.some(h=>h.signature===signature);if(repeated){report.repeatedPairsLast20++;if(groups.some(g=>!s.history.some(h=>h.signature===g[0].signature)))report.avoidableRepeatedPairs++;}
   if(choices.length>1)report.alternativeSolutions++;
   const op=choices[(seed+round)%choices.length];
   if(s.history.some(h=>h.shape===op.shape))report.repeatedStatesLast20++;
   if(s.history.at(-2)?.shape===op.shape)report.immediateReturns++;
   if(s.history.at(-4)?.shape===op.shape){report.fourMoveReturns++;if(new Set(s.history.slice(-4).map(h=>h.shape)).size<=3)report.threeStateOscillations++;}
   assert.equal(session.act(op.tool,op.cell),'correct');
   report[op.tool==='place'?'additions':'removals']++;
   const cells=session.puzzle.cells;assert(cells.every(inGrid));assert.equal(new Set(cells.map(String)).size,cells.length);assert(connected(s.fixed,session.puzzle.placed));assert.equal(s.lives,3);assert.equal(s.round,round+2);
   assert.equal(shapeKey(cells),op.shape);assert(taskGroups(s.fixed,session.puzzle.placed).length>0,'Dead end');
   report.minCubes=Math.min(report.minCubes,cells.length);report.maxCubes=Math.max(report.maxCubes,cells.length);signatures.add(signature);shapes.add(op.shape);
   if(round%250===0){assert(readArcadeSave(storage),'Invalid serialized state');report.restores++;}
  }
  report.uniquePairs=signatures.size;report.uniqueStates=shapes.size;report.seconds=Number(((performance.now()-start)/1000).toFixed(2));
  reports.push(report);console.log(JSON.stringify(report));
 }
 await mkdir('artifacts',{recursive:true});await writeFile('artifacts/arcade-simulation.json',JSON.stringify({totalRounds:30000,reports},null,2));
}finally{await server.close();}
