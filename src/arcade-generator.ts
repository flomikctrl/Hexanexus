import {allCells,identity,key,type Vec} from './math';
import {adjacent,connected} from './connectivity';
import {matches,project,type Targets} from './projections';
import type {Tool} from './interaction';

export interface ArcadeOperation {tool:Tool;cell:Vec;placed:Vec[];targets:Targets;shape:string;signature:string}
export interface ArcadeHistory {shape:string;signature:string}
export interface RandomState {rng:number}
export const shapeKey=(cells:Vec[])=>cells.map(key).sort().join(';');
export const projectionKey=(targets:Targets)=>targets.map(mask=>mask.map(Number).join('')).join('/');
export function random(state:RandomState){let n=state.rng|0;n^=n<<13;n^=n>>>17;n^=n<<5;state.rng=n>>>0;return state.rng/4294967296;}

// Enumerate physical operations first. Hidden moves remain legal player mistakes,
// but cannot become a task if they leave the pair of silhouettes unchanged.
export function legalOperations(fixed:Vec[],placed:Vec[]):ArcadeOperation[]{
 const cells=[...fixed,...placed],occupied=new Set(cells.map(key)),out:ArcadeOperation[]=[];
 const add=(tool:Tool,cell:Vec,next:Vec[])=>{const targets=project([...fixed,...next],identity());out.push({tool,cell,placed:next,targets,shape:shapeKey([...fixed,...next]),signature:projectionKey(targets)});};
 for(const cell of allCells)if(!occupied.has(key(cell))&&cells.some(v=>adjacent(v,cell)))add('place',cell,[...placed,cell]);
 placed.forEach((cell,i)=>{const next=placed.filter((_,j)=>j!==i);if(connected(fixed,next))add('remove',cell,next);});
 return out;
}
export function taskGroups(fixed:Vec[],placed:Vec[]){
 const current=project([...fixed,...placed],identity()),groups=new Map<string,ArcadeOperation[]>();
 for(const op of legalOperations(fixed,placed))if(!matches(current,op.targets)){
  const group=groups.get(op.signature)??[];group.push(op);groups.set(op.signature,group);
 }
 return [...groups.values()];
}
export function chooseTask(fixed:Vec[],placed:Vec[],history:ArcadeHistory[],state:RandomState):Targets {
 const groups=taskGroups(fixed,placed);
 // Every changing move has a changing legal inverse. From the connected initial
 // board this invariant guarantees at least one task forever, including fallback.
 if(!groups.length)throw Error('У конструкции нет одноходовой задачи.');
 const count=fixed.length+placed.length;
 const weights=groups.map(group=>{
  const adding=group[0].tool==='place';let weight=adding?(count<9?4:count>15?.2:1):(count<9?.35:count>15?4:1);
  if(history.some(h=>h.signature===group[0].signature))weight*=.025;
  if(group.every(op=>history.some(h=>h.shape===op.shape)))weight*=.08;
  if(group.every(op=>op.shape===history.at(-2)?.shape))weight*=.015;
  return weight;
 });
 let pick=random(state)*weights.reduce((a,b)=>a+b,0),index=weights.length-1;
 for(let i=0;i<weights.length;i++){pick-=weights[i];if(pick<=0){index=i;break;}}
 return structuredClone(groups[index][0].targets);
}
export function initialBoard(state:RandomState){
 // Five connected immutable anchors; two initial extensions make seven cubes.
 const fixed:Vec[]=[[0,-1,0],[0,0,0],[-1,-1,0],[0,-1,-1],[1,-1,0]];
 let placed:Vec[]=[];
 for(let i=0;i<2;i++){const options=legalOperations(fixed,placed).filter(op=>op.tool==='place');placed=options[Math.floor(random(state)*options.length)].placed;}
 return {fixed:structuredClone(fixed),placed:structuredClone(placed)};
}
