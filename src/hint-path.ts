import {allCells,apply,key,type Mat,type Vec} from './math';
import {connectedOrder} from './connectivity';
import {Puzzle} from './state';
import type {Level} from './levels';
import type {Tool} from './interaction';
import {findLargeHintPath} from './large-solver';

export interface HintStep {tool:Tool;cell:Vec}
export interface NumberedHint extends HintStep {number:number}
export interface HintSnapshot {level:Level;placed:Vec[];orientation:Mat}
export interface HintPathResult {status:'found'|'solved'|'limit'|'impossible';steps:HintStep[];expanded:number;fallback:boolean}
export const hintSnapshot=(p:Puzzle):HintSnapshot=>structuredClone({level:p.level,placed:p.placed,orientation:p.orientation});
export function hintPuzzle(s:HintSnapshot){const p=new Puzzle(structuredClone(s.level));p.placed=structuredClone(s.placed);p.orientation=structuredClone(s.orientation);return p;}
export const hintSignature=(p:Puzzle)=>JSON.stringify([p.level,p.orientation,p.placed.map(key).sort()]);
export function replayHints(snapshot:HintSnapshot,steps:HintStep[],requireWin=true):Puzzle|null {
 const p=hintPuzzle(snapshot);
 for(const step of steps){if(!(step.tool==='place'?p.place(step.cell):p.remove(step.cell)))return null;p.history=[];}
 return !requireWin||p.won?p:null;
}
const count=(n:number)=>{let c=0;while(n){n&=n-1;c++;}return c;};
interface Node {mask:number;g:number;f:number;parent:Node|null;step:HintStep|null}
class Heap {
 private values:Node[]=[];
 private before(a:Node,b:Node){return a.f<b.f||a.f===b.f&&a.g>b.g;}
 get length(){return this.values.length;}
 push(value:Node){let i=this.values.length;this.values.push(value);while(i){const p=(i-1)>>1;if(!this.before(value,this.values[p]))break;this.values[i]=this.values[p];i=p;}this.values[i]=value;}
 pop(){const first=this.values[0],last=this.values.pop()!;if(this.values.length){let i=0;while(i*2+1<this.values.length){let child=i*2+1;if(child+1<this.values.length&&this.before(this.values[child+1],this.values[child]))child++;if(this.before(last,this.values[child]))break;this.values[i]=this.values[child];i=child;}this.values[i]=last;}return first;}
}

// A bounded search over real legal states, with a guaranteed legal rebuild
// fallback when a solution from the immutable anchors is cheaper to find.
export function findHintPath(s:HintSnapshot,options:{maxExpanded?:number;maxMs?:number;now?:()=>number;directBudget?:number}={}):HintPathResult {
 if(s.level.size===4)return findLargeHintPath(s,options);
 const now=options.now??(()=>performance.now()),started=now(),maxMs=options.maxMs??700,maxExpanded=options.maxExpanded??22000;
 let expanded=0,limited=false;
 const result=(status:HintPathResult['status'],steps:HintStep[]=[],fallback=false):HintPathResult=>({status,steps,expanded,fallback});
 const index=new Map(allCells.map((cell,i)=>[key(cell),i]));
 const bits=(cells:Vec[])=>cells.reduce((mask,cell)=>mask|(1<<index.get(key(cell))!),0);
 if([...s.level.fixed,...s.placed,...s.level.available].some(p=>!index.has(key(p)))||!s.level.fixed.length||s.placed.length>s.level.limit||new Set([...s.level.fixed,...s.placed].map(key)).size!==s.level.fixed.length+s.placed.length||!connectedOrder(s.level.fixed,s.placed))return result('impossible');
 const initial=hintPuzzle(s);if(initial.won)return result('solved');
 const fixed=bits(s.level.fixed),start=bits(s.placed),available=bits(s.level.available)&~fixed;
 if(start&~available)return result('impossible');
 const neighbors=allCells.map(p=>allCells.reduce((mask,q,i)=>p.reduce((n,v,a)=>n+Math.abs(v-q[a]),0)===1?mask|(1<<i):mask,0));
 const covers=allCells.map(p=>{const[x,y,z]=apply(s.orientation,p);return (1<<((1-y)*3+x+1))|(1<<(9+(1-y)*3+z+1));});
 const projected=(mask:number)=>{let out=0;while(mask){const bit=mask&-mask;out|=covers[31-Math.clz32(bit)];mask^=bit;}return out;};
 const goal=s.level.targets.flat().reduce((n,v,i)=>v?n|(1<<i):n,0),base=projected(fixed);
 if(base&~goal)return result('impossible');
 const valid=allCells.reduce((mask,_,i)=>available&(1<<i)&&!(covers[i]&~goal)?mask|(1<<i):mask,0);
 if((base|projected(valid))!==goal)return result('impossible');
 const rooted=(mask:number)=>{
  const full=mask|fixed;let reached=fixed,front=fixed;
  while(front){let next=0;while(front){const bit=front&-front;next|=neighbors[31-Math.clz32(bit)];front^=bit;}front=next&full&~reached;reached|=front;}
  return (mask&~reached)===0;
 };
 const adjacentMask=(full:number)=>{let adjacent=0;while(full){const bit=full&-full;adjacent|=neighbors[31-Math.clz32(bit)];full^=bit;}return adjacent;};
 const heuristic=(mask:number,coverage:number)=>count(mask&~valid)+Math.ceil(count(goal&~coverage)/2);
 const search=(origin:number,onlyAdd:boolean,budget:number,deadline:number):HintStep[]|null=>{
  const heap=new Heap(),seen=new Map<number,number>();heap.push({mask:origin,g:0,f:heuristic(origin,projected(origin)|base),parent:null,step:null});seen.set(origin,0);let local=0;
  while(heap.length){
   if(local>=budget||expanded>=maxExpanded||now()-started>=deadline){limited=true;return null;}
   const node=heap.pop();if(seen.get(node.mask)!==node.g)continue;
   const coverage=base|projected(node.mask);if(coverage===goal){const path:HintStep[]=[];for(let n:Node|null=node;n?.step;n=n.parent)path.push(n.step);return path.reverse();}
   local++;expanded++;
   const size=count(node.mask);
   const add=(mask:number,tool:Tool,i:number)=>{const g=node.g+1;if(g>=(seen.get(mask)??Infinity))return;const coverage=base|projected(mask);if(onlyAdd&&Math.ceil(count(goal&~coverage)/2)>s.level.limit-count(mask))return;seen.set(mask,g);heap.push({mask,g,f:g+heuristic(mask,coverage),parent:node,step:{tool,cell:[...allCells[i]]}});};
   if(size<s.level.limit){let choices=valid&~node.mask&adjacentMask(node.mask|fixed);while(choices){const bit=choices&-choices;choices^=bit;add(node.mask|bit,'place',31-Math.clz32(bit));}}
   if(!onlyAdd){let choices=node.mask;while(choices){const bit=choices&-choices;choices^=bit;if(rooted(node.mask^bit))add(node.mask^bit,'remove',31-Math.clz32(bit));}}
   // Bound queued states as well as expanded ones, keeping mobile memory finite.
   if(seen.size>maxExpanded*5){limited=true;return null;}
  }
  return null;
 };
 const direct=search(start,false,options.directBudget??Math.max(1,Math.floor(maxExpanded*.65)),maxMs*.65);
 if(direct&&replayHints(s,direct))return result('found',direct);
 // Removing a rooted forest in reverse connection order never strands blocks.
 // This permits a correct bounded fallback without treating one reference board
 // as the only answer. The rebuilt goal is still searched from both silhouettes.
 const rebuilt=search(0,true,maxExpanded,maxMs);
 if(rebuilt){const order=connectedOrder(s.level.fixed,s.placed)!;const path:HintStep[]=[...order.reverse().map(cell=>({tool:'remove' as const,cell})),...rebuilt];if(replayHints(s,path))return result('found',path,true);}
 return result(limited?'limit':'impossible');
}

export class HintChain {
 private steps:NumberedHint[]=[];
 private shown=new Set<number>();
 private snapshot:HintSnapshot|null=null;
 private signature='';
 get planned(){return this.steps.map(step=>structuredClone(step));}
 get visible(){return this.steps.filter(step=>this.shown.has(step.number)).map(step=>structuredClone(step));}
 get hasPlan(){return this.snapshot!==null;}
 get complete(){return this.hasPlan&&this.steps.every(step=>this.shown.has(step.number));}
 get virtual(){return this.snapshot?replayHints(this.snapshot,this.visible,false):null;}
 clear(){this.steps=[];this.shown.clear();this.snapshot=null;this.signature='';}
 set(puzzle:Puzzle,path:HintStep[]){const snapshot=hintSnapshot(puzzle);if(!replayHints(snapshot,path))return false;this.steps=path.map((s,i)=>({...structuredClone(s),number:i+1}));this.shown.clear();this.snapshot=snapshot;this.signature=hintSignature(puzzle);return true;}
 next(){const step=this.steps.find(step=>!this.shown.has(step.number));if(step)this.shown.add(step.number);return step?structuredClone(step):null;}
 reconcile(puzzle:Puzzle){
  if(!this.snapshot)return;
  const signature=hintSignature(puzzle);if(signature===this.signature)return;
  if(puzzle.won){this.clear();return;}
  if(JSON.stringify([this.snapshot.level,this.snapshot.orientation])!==JSON.stringify([puzzle.level,puzzle.orientation])){this.clear();return;}
  const previous=new Set(this.snapshot.placed.map(key)),current=new Set(puzzle.placed.map(key));
  const added=puzzle.placed.filter(p=>!previous.has(key(p))),removed=this.snapshot.placed.filter(p=>!current.has(key(p)));
  const snapshot=hintSnapshot(puzzle);let remaining=this.steps;
  if(!replayHints(snapshot,remaining)){
   if(added.length+removed.length!==1){this.clear();return;}
   const tool:Tool=added.length?'place':'remove',cell=(added[0]??removed[0]);let found:NumberedHint[]|null=null;
   for(let i=0;i<this.steps.length;i++)if(this.steps[i].tool===tool&&key(this.steps[i].cell)===key(cell)){
    const candidate=this.steps.filter((_,j)=>j!==i);if(replayHints(snapshot,candidate)){found=candidate;break;}
   }
   if(!found){this.clear();return;}remaining=found;
  }
  this.steps=remaining;this.shown=new Set(this.steps.filter(step=>this.shown.has(step.number)).map(step=>step.number));this.snapshot=snapshot;this.signature=signature;
 }
}
