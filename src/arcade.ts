import {allCells,identity,key,type Vec} from './math';
import {connected,inGrid} from './connectivity';
import {matches,project,type Targets} from './projections';
import {Puzzle} from './state';
import type {Tool} from './interaction';
import {chooseTask,initialBoard,projectionKey,shapeKey,taskGroups,type ArcadeHistory} from './arcade-generator';

export const arcadeSaveKey='hexanexus.arcade.session.v1',arcadeRecordsKey='hexanexus.arcade.records.v1';
export type ArcadeStorage=Pick<Storage,'getItem'|'setItem'>;
export const roundLimit=(round:number)=>Math.max(30,90-10*Math.floor((round-1)/5))*1000;
export interface ArcadeSave {
 version:1;id:string;rng:number;fixed:Vec[];placed:Vec[];targets:Targets;round:number;lives:number;
 remainingMs:number;score:number;streak:number;bestStreak:number;paused:boolean;finished:boolean;
 history:ArcadeHistory[];recordAnnounced:boolean;
}
export interface ArcadeRecords {version:1;bestRound:number;bestScore:number;bestStreak:number;games:number;counted:string[]}
export type ArcadeEvent={type:'correct'|'mistake'|'timeout'|'end'|'record';id:string;round:number;score:number;streak:number};
export type ArcadeResult='correct'|'mistake'|'invalid'|'blocked'|'timeout'|'end';
const freshRecords=():ArcadeRecords=>({version:1,bestRound:0,bestScore:0,bestStreak:0,games:0,counted:[]});
const integer=(n:unknown,min:number,max=1e12):n is number=>typeof n==='number'&&Number.isSafeInteger(n)&&n>=min&&n<=max;
const cells=(v:unknown):v is Vec[]=>Array.isArray(v)&&v.length<=27&&v.every(p=>Array.isArray(p)&&p.length===3&&inGrid(p as Vec))&&new Set(v.map(key)).size===v.length;
export function readArcadeRecords(storage?:ArcadeStorage):ArcadeRecords {
 try{const r=JSON.parse(storage?.getItem(arcadeRecordsKey)||'null');if(r?.version===1&&['bestRound','bestScore','bestStreak','games'].every(k=>integer(r[k],0))&&Array.isArray(r.counted)&&r.counted.length<=100&&r.counted.every((id:unknown)=>typeof id==='string'&&id.length<=80))return r;}catch{}
 return freshRecords();
}
export function readArcadeSave(storage?:ArcadeStorage):ArcadeSave|null {
 try{
  const s=JSON.parse(storage?.getItem(arcadeSaveKey)||'null');
  if(s?.version!==1||typeof s.id!=='string'||!s.id.length||s.id.length>80||!integer(s.rng,1,0xffffffff)||!cells(s.fixed)||!s.fixed.length||!cells(s.placed)||s.fixed.length+s.placed.length>27)return null;
  if(new Set([...s.fixed,...s.placed].map(key)).size!==s.fixed.length+s.placed.length||!connected([s.fixed[0]],s.fixed.slice(1))||!connected(s.fixed,s.placed))return null;
  if(!Array.isArray(s.targets)||s.targets.length!==2||!s.targets.every((m:unknown)=>Array.isArray(m)&&m.length===9&&m.every(b=>typeof b==='boolean')))return null;
  if(!integer(s.round,1,1e8)||!integer(s.lives,0,3)||!integer(s.score,0)||!integer(s.streak,0,s.round-1)||!integer(s.bestStreak,s.streak,s.round-1))return null;
  if(typeof s.remainingMs!=='number'||!Number.isFinite(s.remainingMs)||s.remainingMs<0||s.remainingMs>roundLimit(s.round)||typeof s.paused!=='boolean'||typeof s.finished!=='boolean'||s.finished!==(s.lives===0)||typeof s.recordAnnounced!=='boolean')return null;
  if(!Array.isArray(s.history)||!s.history.length||s.history.length>20||!s.history.every((h:ArcadeHistory)=>typeof h?.shape==='string'&&h.shape.length<250&&typeof h.signature==='string'&&/^[01]{9}\/[01]{9}$/.test(h.signature)))return null;
  if(s.history.at(-1).shape!==shapeKey([...s.fixed,...s.placed])||s.history.at(-1).signature!==projectionKey(project([...s.fixed,...s.placed],identity())))return null;
  if(!taskGroups(s.fixed,s.placed).some(group=>matches(group[0].targets,s.targets)))return null;
  return {...s,paused:true}; // No wall-clock catch-up after restoring the app.
 }catch{return null;}
}

export class ArcadeSession {
 readonly puzzle:Puzzle;
 records:ArcadeRecords;
 saveFailed=false;
 private last:number;
 private initialBest:number;
 constructor(public state:ArcadeSave,private storage?:ArcadeStorage,private now:()=>number=()=>performance.now(),private emit:(event:ArcadeEvent)=>void=()=>{}){
  this.records=readArcadeRecords(storage);this.initialBest=this.records.bestScore;this.last=now();
  this.puzzle=new Puzzle({name:'Бесконечный режим',fixed:structuredClone(state.fixed),available:allCells.filter(p=>!state.fixed.some(v=>key(v)===key(p))),limit:27-state.fixed.length,targets:state.targets,orientation:identity()});
  this.puzzle.placed=structuredClone(state.placed);
 }
 static create(seed:number,storage?:ArcadeStorage,now?:()=>number,emit?:(e:ArcadeEvent)=>void){
  const rng={rng:(seed>>>0)||1},board=initialBoard(rng),history=[{shape:shapeKey([...board.fixed,...board.placed]),signature:projectionKey(project([...board.fixed,...board.placed],identity()))}];
  const targets=chooseTask(board.fixed,board.placed,history,rng);
  const s=new ArcadeSession({version:1,id:globalThis.crypto?.randomUUID?.()??`${Date.now()}-${seed}-${Math.random()}`,rng:rng.rng,...board,targets,round:1,lives:3,remainingMs:roundLimit(1),score:0,streak:0,bestStreak:0,paused:true,finished:false,history,recordAnnounced:false},storage,now,emit);s.persist();return s;
 }
 static restore(storage?:ArcadeStorage,now?:()=>number,emit?:(e:ArcadeEvent)=>void){const data=readArcadeSave(storage);return data?new ArcadeSession(data,storage,now,emit):null;}
 private event(type:ArcadeEvent['type']){this.emit({type,id:this.state.id,round:this.state.round,score:this.state.score,streak:this.state.streak});}
 private write(key:string,value:unknown){if(!this.storage){this.saveFailed=true;return;}try{this.storage.setItem(key,JSON.stringify(value));}catch{this.saveFailed=true;}}
 persist(){this.state.placed=structuredClone(this.puzzle.placed);this.write(arcadeSaveKey,this.state);}
 private updateRecords(){
  const s=this.state,r=this.records;r.bestRound=Math.max(r.bestRound,s.round);r.bestScore=Math.max(r.bestScore,s.score);r.bestStreak=Math.max(r.bestStreak,s.bestStreak);
  if(s.finished&&!r.counted.includes(s.id)){r.games++;r.counted=[...r.counted.slice(-99),s.id];}
  this.write(arcadeRecordsKey,r);
 }
 private lose(type:'mistake'|'timeout'){
  this.state.lives--;this.state.streak=0;this.event(type);
  if(this.state.lives===0){this.state.finished=true;this.state.paused=true;this.event('end');}
  this.updateRecords();this.persist();return this.state.finished?'end':type;
 }
 tick():ArcadeResult|undefined {
  const now=Math.max(this.last,this.now()),elapsed=now-this.last;this.last=now;
  if(this.state.paused||this.state.finished)return;
  this.state.remainingMs=Math.max(0,this.state.remainingMs-elapsed);
  if(this.state.remainingMs===0){if(this.state.lives>1)this.state.remainingMs=roundLimit(this.state.round);return this.lose('timeout');}
 }
 pause(settle=true){if(settle)this.tick();else this.last=this.now();this.state.paused=true;this.persist();}
 resume(){if(this.state.finished)return;this.last=this.now();this.state.paused=false;this.persist();}
 act(tool:Tool,cell:Vec):ArcadeResult {
  if(this.state.paused||this.state.finished)return 'blocked';
  const expired=this.tick();if(expired)return expired;
  if(!(tool==='place'?this.puzzle.place(cell):this.puzzle.remove(cell)))return 'invalid';
  if(!matches(this.puzzle.projections,this.state.targets)){this.puzzle.undo();this.puzzle.history=[];return this.lose('mistake');}
  const s=this.state;s.streak++;s.bestStreak=Math.max(s.bestStreak,s.streak);
  s.score+=100+Math.floor(s.remainingMs/1000/3)+Math.min(10,s.streak-1)*5;s.round++;
  s.history=[...s.history.slice(-19),{shape:shapeKey(this.puzzle.cells),signature:projectionKey(this.puzzle.projections)}];
  s.targets=chooseTask(s.fixed,this.puzzle.placed,s.history,s);this.puzzle.level.targets=s.targets;this.puzzle.history=[];
  s.remainingMs=roundLimit(s.round);this.last=this.now();
  const record=!s.recordAnnounced&&s.score>this.initialBest;if(record)s.recordAnnounced=true;
  // Persist the completed round before emitting its reward. Startup can recover
  // a crash between this write and the economy transaction using id + round.
  this.updateRecords();this.persist();this.event('correct');if(record)this.event('record');return 'correct';
 }
}
