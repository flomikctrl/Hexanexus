import {apply,gridCells,gridSize,key,type Mat,type Vec} from './math';
import {connectedOrder} from './connectivity';
import {Puzzle} from './state';
import type {Level} from './levels';
import type {HintPathResult,HintSnapshot,HintStep} from './hint-path';

interface Node {mask:bigint;coverage:bigint;g:number;f:number;parent:Node|null;step:HintStep|null}
class Queue {
 private a:Node[]=[];
 get length(){return this.a.length;}
 private less(a:Node,b:Node){return a.f<b.f||a.f===b.f&&a.g>b.g;}
 push(n:Node){let i=this.a.length;this.a.push(n);while(i){const p=(i-1)>>1;if(!this.less(n,this.a[p]))break;this.a[i]=this.a[p];i=p;}this.a[i]=n;}
 pop(){const top=this.a[0],last=this.a.pop()!;if(this.a.length){let i=0;while(i*2+1<this.a.length){let c=i*2+1;if(c+1<this.a.length&&this.less(this.a[c+1],this.a[c]))c++;if(this.less(last,this.a[c]))break;this.a[i]=this.a[c];i=c;}this.a[i]=last;}return top;}
}
const popcount=(v:bigint)=>{let n=0;while(v){v&=v-1n;n++;}return n;};
// Unlike 32-bit JS operators, these masks retain every one of the 64 cells.
export function findLargeHintPath(snapshot:HintSnapshot,options:{maxExpanded?:number;maxMs?:number;now?:()=>number;directBudget?:number}={}):HintPathResult{
 const size=gridSize(snapshot.level),cells=gridCells(size),bits=cells.map((_,i)=>1n<<BigInt(i)),index=new Map(cells.map((p,i)=>[key(p),i]));
 const now=options.now??(()=>performance.now()),started=now(),maxMs=options.maxMs??1400,maxExpanded=options.maxExpanded??45000;let expanded=0,limited=false;
 const result=(status:HintPathResult['status'],steps:HintStep[]=[],fallback=false):HintPathResult=>({status,steps,expanded,fallback});
 const l=snapshot.level,initial=new Puzzle(l);initial.placed=structuredClone(snapshot.placed);initial.orientation=snapshot.orientation;
 if(!l.fixed.length||[...l.fixed,...l.available,...snapshot.placed].some(p=>!index.has(key(p)))||new Set(initial.cells.map(key)).size!==initial.cells.length||!connectedOrder(l.fixed,snapshot.placed)||snapshot.placed.length>l.limit||l.targets.some(m=>m.length!==size*size))return result('impossible');
 if(initial.won)return result('solved');
 const mask=(p:Vec[])=>p.reduce((v,p)=>v|bits[index.get(key(p))!],0n),fixed=mask(l.fixed),start=mask(snapshot.placed),available=mask(l.available)&~fixed,c=(size-1)/2;
 if(start&~available)return result('impossible');
 const covers=cells.map(p=>{const[x,y,z]=apply(snapshot.orientation,p);return (1n<<BigInt((c-y)*size+x+c))|(1n<<BigInt(size*size+(c-y)*size+z+c));});
 const each=(m:bigint,fn:(i:number)=>void)=>{for(let i=0;i<cells.length;i++)if(m&bits[i])fn(i);};
 const coverage=(m:bigint)=>{let out=0n;each(m,i=>out|=covers[i]);return out;};
 const goal=l.targets.flat().reduce((v,b,i)=>b?v|(1n<<BigInt(i)):v,0n),base=coverage(fixed);
 const valid=covers.reduce((v,cv,i)=>available&bits[i]&&!(cv&~goal)?v|bits[i]:v,0n);
 if(base&~goal||(base|coverage(valid))!==goal)return result('impossible');
 const adjacent=cells.map(p=>cells.reduce((m,q,i)=>p.reduce((n,v,a)=>n+Math.abs(v-q[a]),0)===1?m|bits[i]:m,0n));
 const frontier=(m:bigint)=>{let out=0n;each(m,i=>out|=adjacent[i]);return out;};
 const rooted=(m:bigint)=>{let reached=fixed,front=fixed;while(front){front=frontier(front)&(m|fixed)&~reached;reached|=front;}return !(m&~reached);};
 const lowerBound=(cv:bigint)=>{let n=0;const missing=goal&~cv;for(let row=0;row<size;row++){const rowBits=((1n<<BigInt(size))-1n)<<BigInt(row*size);n+=Math.max(popcount(missing&rowBits),popcount((missing>>BigInt(size*size))&rowBits));}return n;};
 const search=(origin:bigint,onlyAdd:boolean,budget:number,deadline:number)=>{
  const queue=new Queue(),seen=new Map<bigint,number>(),cv=base|coverage(origin);queue.push({mask:origin,coverage:cv,g:0,f:3*lowerBound(cv)+popcount(origin&~valid),parent:null,step:null});seen.set(origin,0);let local=0;
  while(queue.length){
   if(local>=budget||expanded>=maxExpanded||now()-started>=deadline){limited=true;return null;}
   const node=queue.pop();if(seen.get(node.mask)!==node.g)continue;
   if(node.coverage===goal){const out:HintStep[]=[];for(let n:Node|null=node;n?.step;n=n.parent)out.push(n.step);return out.reverse();}
   local++;expanded++;const length=popcount(node.mask);
   const next=(m:bigint,tool:'place'|'remove',i:number)=>{const g=node.g+1;if(g>=(seen.get(m)??Infinity))return;const cv=tool==='place'?node.coverage|covers[i]:base|coverage(m),h=lowerBound(cv);if(onlyAdd&&h>l.limit-popcount(m))return;seen.set(m,g);queue.push({mask:m,coverage:cv,g,f:g+3*h+popcount(m&~valid),parent:node,step:{tool,cell:[...cells[i]]}});};
   if(length<l.limit)each(valid&~node.mask&frontier(node.mask|fixed),i=>next(node.mask|bits[i],'place',i));
   if(!onlyAdd)each(node.mask,i=>{if(rooted(node.mask^bits[i]))next(node.mask^bits[i],'remove',i);});
   if(seen.size>maxExpanded*4){limited=true;return null;}
  }return null;
 };
 const direct=search(start,false,options.directBudget??Math.floor(maxExpanded*.65),maxMs*.65);if(direct)return result('found',direct);
 const rebuilt=search(0n,true,maxExpanded,maxMs);if(rebuilt){const removals=connectedOrder(l.fixed,snapshot.placed)!.reverse().map(cell=>({tool:'remove' as const,cell}));return result('found',[...removals,...rebuilt],true);}
 return result(limited?'limit':'impossible');
}
export function solveLarge(level:Level,orientation:Mat=level.orientation):{placed:Vec[];orientation:Mat}|null{
 const r=findLargeHintPath({level,placed:[],orientation},{maxMs:5000,maxExpanded:200000,directBudget:0});
 return r.status==='solved'?{placed:[],orientation}:r.status==='found'?{placed:r.steps.filter(s=>s.tool==='place').map(s=>s.cell),orientation}:null;
}
