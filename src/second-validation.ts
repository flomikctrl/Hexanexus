import {secondLevels,secondLevelWitnesses} from './levels-second';
import {campaignSignature} from './level-validation';
import {solve} from './solver';
import {Puzzle} from './state';
import {key,type Vec} from './math';
// Deliberately separate projection/adjacency arithmetic from the gameplay helpers.
function verify(fixed:Vec[],steps:Vec[],targets:boolean[][],limit:number){
 const cells=fixed.map(p=>[...p] as Vec),seen=new Set(cells.map(key));
 if(steps.length>limit)throw Error('Inventory exceeded');
 for(const p of steps){if(p.length!==3||p.some(n=>!Number.isInteger(n+1.5)||Math.abs(n)>1.5)||seen.has(key(p)))throw Error('Invalid cell');
  if(!cells.some(q=>Math.abs(q[0]-p[0])+Math.abs(q[1]-p[1])+Math.abs(q[2]-p[2])===1))throw Error('Disconnected action');cells.push(p);seen.add(key(p));}
 const xy=Array(16).fill(false),zy=Array(16).fill(false);
 for(const[x,y,z]of cells){xy[(1.5-y)*4+x+1.5]=true;zy[(1.5-y)*4+z+1.5]=true;}
 if(JSON.stringify([xy,zy])!==JSON.stringify(targets))throw Error('Independent projections differ');
}
export function validateSecondCampaign(){
 const signatures=new Set<string>(),targets=new Set<string>();
 return secondLevels.map((level,i)=>{
  if(level.size!==4||level.targets.some(m=>m.length!==16)||level.fixed.length+level.available.length!==64)throw Error('Wrong dimensions');
  const signature=campaignSignature(level),t=JSON.stringify(level.targets);if(signatures.has(signature)||targets.has(t))throw Error('Duplicate second campaign task: '+level.name);signatures.add(signature);targets.add(t);
  const witness=secondLevelWitnesses[level.name];verify(level.fixed,witness,level.targets,level.limit);
  const start=performance.now(),solution=solve(level);if(!solution)throw Error('Independent search failed: '+level.name);verify(level.fixed,solution.placed,level.targets,level.limit);
  const p=new Puzzle(level);for(const cell of solution.placed)if(!p.place(cell))throw Error('Gameplay rejects solution');if(!p.won)throw Error('Gameplay rejects victory');
  const base=new Puzzle(level).projections,missing=level.targets.flat().filter((v,j)=>v&&!base.flat()[j]).length;
  return {number:i+1,name:level.name,size:4,fixed:level.fixed.length,limit:level.limit,witness,solution:solution.placed,foundMoves:solution.placed.length,coverageLowerBound:Math.ceil(missing/2),searchMs:performance.now()-start,valid:true};
 });
}
