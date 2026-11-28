import {DuelTaskSource} from './generator';
import {ResultJournal,type ResultStorage,type MatchAward} from './results';
import {levels} from '../levels';
import {Puzzle} from '../state';
import {connectedOrder} from '../connectivity';
import {key} from '../math';
import {decodeCommand,type DuelCommand,type DuelPlayer,type DuelServerMessage,type DuelState} from './protocol';
export {privateIPv4,maxDuelMessage} from './protocol';
interface Member extends DuelPlayer {token:string;connection:string|null;goneAt:number|null}
interface Room {state:DuelState;members:Member[];lastActive:number;tasks:DuelTaskSource}
export interface DuelTransport {send:(connection:string,message:DuelServerMessage)=>void;close?:(connection:string)=>void}
export class DuelRooms {
 private rooms=new Map<string,Room>();private connections=new Map<string,{room:Room;member:Member}>();
 private journal:ResultJournal;private recovery=new Map<string,string>();private lastDelivery=0;
 validationCount=0;
 constructor(private transport:DuelTransport,private now=()=>Date.now(),private id:()=>string=()=>crypto.randomUUID(),private token=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),n=>n.toString(16).padStart(2,'0')).join(''),private choose:((round:number)=>number)|undefined=undefined,storage?:ResultStorage){this.journal=new ResultJournal(storage);}
 private error(c:string,message:string){this.transport.send(c,{v:1,type:'error',message});}
 receive(c:string,raw:string){const m=decodeCommand(raw);if(!m){this.error(c,'Некорректное сообщение');return;}
 if(m.type==='recover'){this.recovery.set(c,m.token);this.deliver(c,m.token);this.transport.send(c,{v:1,type:'recovered'});return;}
 if(m.type==='result-ack'){const token=this.connections.get(c)?.member.token??this.recovery.get(c);if(token)this.journal.ack(token,m.id);return;}
 if(m.type==='ping'){this.transport.send(c,{v:1,type:'pong',sentAt:m.sentAt,serverTime:this.now()});return;}
 if(m.type==='create'||m.type==='join'||m.type==='resume'){this.attach(c,m);return;}
 const session=this.connections.get(c);if(!session){this.error(c,'Сначала подключитесь к комнате');return;}const {room:r,member:p}=session,s=r.state;r.lastActive=this.now();
 if(m.type==='leave'){this.leave(c,r,p);return;}
 if(m.type==='ready'){if(s.phase!=='lobby'||!p.connected)return;p.ready=m.ready;if(r.members.length===2&&r.members.every(x=>x.ready&&x.connected))this.prepare(r,true);else this.broadcast(r);return;}
 if(!('matchId'in m)||m.matchId!==s.matchId||m.round!==s.round){this.error(c,'Устаревшее состояние матча');return;}
 if(m.type==='prepared'&&s.phase==='preparing'){p.prepared=true;if(r.members.length===2&&r.members.every(x=>x.prepared&&x.connected)){s.phase='countdown';s.startAt=this.now()+3000;}this.broadcast(r);return;}
 if(m.type==='solution'){this.solve(c,r,p,m);return;}
 if(m.type==='next'&&s.phase==='round-result'||m.type==='rematch'&&['match-result','aborted'].includes(s.phase)){p.next=true;if(r.members.length===2&&r.members.every(x=>x.next&&x.connected))this.prepare(r,m.type==='rematch');else this.broadcast(r);}
 }
 private attach(c:string,m:Extract<DuelCommand,{type:'create'|'join'|'resume'}>){
 if(this.connections.has(c)){this.error(c,'Вы уже в комнате');return;}
 let r:Room|undefined,p:Member|undefined;
 if(m.type==='resume'){
  r=this.rooms.get(m.code);p=r?.members.find(x=>x.token===m.token);if(!r||!p){this.error(c,'Комната или сессия уже закрыта');return;}
  if(p.connection){this.connections.delete(p.connection);this.transport.close?.(p.connection);}p.connection=c;p.connected=true;p.goneAt=null;
 }else{
  if(m.type==='create'){
   if(this.rooms.size>=8){this.error(c,'Сервер занят');return;}let code='';for(let i=0;i<100;i++){const n=String(1000+Math.floor(Math.random()*9000));if(!this.rooms.has(n)){code=n;break;}}if(!code){this.error(c,'Нет свободного кода');return;}
   const state:DuelState={v:1,type:'state',code,revision:0,hostId:'',matchId:this.id(),round:1,phase:'lobby',players:[],task:null,startAt:0,serverTime:this.now(),result:null};r={state,members:[],lastActive:this.now(),tasks:new DuelTaskSource()};this.rooms.set(code,r);
  }else{r=this.rooms.get(m.code);if(!r){this.error(c,'Неверный код комнаты');return;}if(r.members.length>=2){this.error(c,'В комнате уже два игрока');return;}if(r.state.phase!=='lobby'){this.error(c,'Матч уже начался');return;}}
  if(m.type==='join'&&m.identity&&r!.members.some(p=>p.token===m.identity)){this.error(c,'Этот игрок уже в комнате');return;}
  p={id:this.id(),token:m.identity??this.token(),connection:c,goneAt:null,profile:{...m.profile,name:m.profile.name.trim()},connected:true,ready:false,prepared:false,next:false,score:0};r!.members.push(p);if(m.type==='create')r!.state.hostId=p.id;
 }
 this.connections.set(c,{room:r!,member:p!});r!.lastActive=this.now();this.transport.send(c,{v:1,type:'session',code:r!.state.code,playerId:p!.id,token:p!.token});this.broadcast(r!);
 }
 private prepare(r:Room,fresh:boolean){const s=r.state;if(fresh){s.matchId=this.id();s.round=1;r.members.forEach(p=>p.score=0);}else s.round++;
 s.task=this.choose?structuredClone(levels[this.choose(s.round)%6]):r.tasks.next().task;s.phase='preparing';s.result=null;s.startAt=0;r.members.forEach(p=>{p.ready=false;p.prepared=false;p.next=false;});this.broadcast(r);
 }
 private solve(c:string,r:Room,p:Member,m:Extract<DuelCommand,{type:'solution'}>){const s=r.state;if(s.phase!=='playing'||this.now()<s.startAt||!r.members.every(x=>x.connected)||!s.task)return;
 this.validationCount++;if(m.placed.length>s.task.limit||new Set(m.placed.map(key)).size!==m.placed.length||!m.placed.every(cell=>s.task!.available.some(v=>key(v)===key(cell)))){this.error(c,'Некорректный набор кубиков');return;}const puzzle=new Puzzle(s.task),order=connectedOrder(s.task.fixed,m.placed);if(!order||!order.every(cell=>puzzle.place(cell))||!puzzle.won){this.error(c,'Силуэты пока не совпадают');return;}
 if(p.score===1){const scores=r.members.map(x=>({id:x.id,score:x.score+(x===p?1:0)}));const deliveries=r.members.map(x=>({token:x.token,award:{v:1 as const,type:'award' as const,id:s.matchId,playerId:x.id,winnerId:p.id,finishedAt:this.now(),scores}}));if(!this.journal.save(deliveries)){this.error(c,'Не удалось сохранить результат. Повторите решение.');return;}}
 p.score++;s.result={winnerId:p.id,elapsedMs:Math.max(0,this.now()-s.startAt),technical:false,reason:'Головоломка решена'};s.phase=p.score>=2?'match-result':'round-result';r.members.forEach(x=>x.next=false);this.broadcast(r);
 }
 private deliver(c:string,token:string){for(const a of this.journal.forToken(token))this.transport.send(c,a);}
 private broadcast(r:Room){r.state.revision++;r.state.serverTime=this.now();r.state.players=r.members.map(({token:_,connection:__,goneAt:___,...p})=>structuredClone(p));for(const p of r.members)if(p.connection){this.deliver(p.connection,p.token);this.transport.send(p.connection,structuredClone(r.state));}}
 disconnect(c:string){this.recovery.delete(c);const session=this.connections.get(c);if(!session)return;this.connections.delete(c);const {room:r,member:p}=session;if(p.connection!==c)return;p.connected=false;p.connection=null;p.goneAt=this.now();p.ready=false;
 if(['preparing','countdown','playing','round-result'].includes(r.state.phase)){r.state.phase='aborted';r.state.result={winnerId:null,elapsedMs:0,technical:true,reason:'Соединение прервано. Кубки не начисляются.'};r.members.forEach(x=>x.next=false);}this.broadcast(r);
 }
 private leave(c:string,r:Room,p:Member){if(p.id===r.state.hostId){this.closeRoom(r,'Хозяин закрыл комнату');return;}this.connections.delete(c);r.members=r.members.filter(x=>x!==p);r.state.phase='lobby';r.state.task=null;r.state.result=null;r.members.forEach(x=>{x.ready=false;x.score=0;});this.transport.send(c,{v:1,type:'closed',message:'Вы вышли из комнаты'});this.broadcast(r);}
 private closeRoom(r:Room,message:string){for(const p of r.members)if(p.connection){this.transport.send(p.connection,{v:1,type:'closed',message});this.connections.delete(p.connection);this.transport.close?.(p.connection);}this.rooms.delete(r.state.code);}
 tick(){if(this.now()-this.lastDelivery>=2000){this.lastDelivery=this.now();for(const [c,s]of this.connections)this.deliver(c,s.member.token);}for(const r of this.rooms.values()){
  const host=r.members.find(p=>p.id===r.state.hostId)!;
  if(host.goneAt!==null&&this.now()-host.goneAt>15000||this.now()-r.lastActive>30*60*1000){this.closeRoom(r,'Комната закрыта: хозяин недоступен или истёк срок ожидания');continue;}
  const guest=r.members.find(p=>p.id!==r.state.hostId);if(guest?.goneAt!==null&&guest?.goneAt!==undefined&&this.now()-guest.goneAt>30000){r.members=r.members.filter(p=>p!==guest);r.state.phase='lobby';r.state.task=null;host.ready=false;host.score=0;this.broadcast(r);}
  if(r.state.phase==='countdown'&&this.now()>=r.state.startAt&&r.members.every(p=>p.connected)){r.state.phase='playing';this.broadcast(r);}
 }}
 shutdown(){for(const r of [...this.rooms.values()])this.closeRoom(r,'Сервер остановлен');}
}
