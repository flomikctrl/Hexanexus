import type {MatchAward} from './results';
import type {Level} from '../levels';
import type {Vec} from '../math';
import {isSkinId,type MotyaSkinId,type MotyaEmotion} from '../motya-skins';
export const duelProtocol=1;
export const maxDuelMessage=8192;
export type DuelPhase='lobby'|'preparing'|'countdown'|'playing'|'round-result'|'match-result'|'aborted';
export interface DuelProfile {name:string;skin:MotyaSkinId;emotion:MotyaEmotion}
export interface DuelPlayer {id:string;profile:DuelProfile;connected:boolean;ready:boolean;prepared:boolean;next:boolean;score:number}
export interface DuelState {v:1;type:'state';code:string;revision:number;hostId:string;matchId:string;round:number;phase:DuelPhase;players:DuelPlayer[];task:Level|null;startAt:number;serverTime:number;result:{winnerId:string|null;elapsedMs:number;technical:boolean;reason:string}|null}
export type DuelCommand=
 |{v:1;type:'recover';token:string}|{v:1;type:'result-ack';id:string}

 |{v:1;type:'create';profile:DuelProfile;identity?:string}|{v:1;type:'join';code:string;profile:DuelProfile;identity?:string}
 |{v:1;type:'resume';code:string;token:string}|{v:1;type:'leave'}|{v:1;type:'ping';sentAt:number}
 |{v:1;type:'ready';ready:boolean}
 |{v:1;type:'prepared'|'next'|'rematch';matchId:string;round:number}
 |{v:1;type:'solution';matchId:string;round:number;placed:Vec[]};
export type DuelServerMessage={v:1;type:'recovered'}|MatchAward|DuelState|{v:1;type:'session';code:string;playerId:string;token:string}|{v:1;type:'error'|'closed';message:string}|{v:1;type:'pong';sentAt:number;serverTime:number};
export function privateIPv4(host:string){if(host==='localhost'||host==='127.0.0.1'||host==='::1')return true;const p=host.split('.');if(p.length!==4||p.some(n=>!/^\d{1,3}$/.test(n)||Number(n)>255||String(Number(n))!==n))return false;const [a,b]=p.map(Number);return a===10||a===192&&b===168||a===172&&b>=16&&b<=31;}
export function duelAddress(input:string){try{const u=new URL(input.includes('://')?input:'ws://'+input);if(u.protocol!=='ws:'||!privateIPv4(u.hostname)||u.username||u.password||u.search||u.hash||!['','/','/duels'].includes(u.pathname))return null;const port=u.port?Number(u.port):8787;if(port<1024||port>65535)return null;return `ws://${u.hostname}:${port}/duels`;}catch{return null;}}
function profile(p:unknown):p is DuelProfile{if(!p||typeof p!=='object')return false;const v=p as DuelProfile;return typeof v.name==='string'&&v.name.trim().length>0&&Array.from(v.name).length<=20&&/^[\p{L}\p{M}\p{N} _-]+$/u.test(v.name)&&isSkinId(v.skin)&&['IDLE','SAD','SHOCK'].includes(v.emotion);}
export function decodeCommand(raw:string):DuelCommand|null {
 if(raw.length>maxDuelMessage)return null;try{const m=JSON.parse(raw);if(m?.v!==1||typeof m.type!=='string')return null;
 if(m.type==='recover')return typeof m.token==='string'&&/^[a-f0-9]{64}$/.test(m.token)?m:null;
 if(m.type==='result-ack')return typeof m.id==='string'&&m.id.length>0&&m.id.length<=80?m:null;
 if(['create','join'].includes(m.type)&&m.identity!==undefined&&!(typeof m.identity==='string'&&/^[a-f0-9]{64}$/.test(m.identity)))return null;
 if(m.type==='create')return profile(m.profile)?m:null;
 if(m.type==='join')return typeof m.code==='string'&&/^\d{4}$/.test(m.code)&&profile(m.profile)?m:null;
 if(m.type==='resume')return typeof m.code==='string'&&/^\d{4}$/.test(m.code)&&typeof m.token==='string'&&/^[a-f0-9]{64}$/.test(m.token)?m:null;
 if(m.type==='leave')return m;
 if(m.type==='ping')return Number.isFinite(m.sentAt)&&m.sentAt>=0?m:null;
 if(m.type==='ready')return typeof m.ready==='boolean'?m:null;
 if(!['prepared','solution','next','rematch'].includes(m.type)||typeof m.matchId!=='string'||m.matchId.length>80||!Number.isInteger(m.round)||m.round<1||m.round>3)return null;
 if(m.type==='solution'&&(!Array.isArray(m.placed)||m.placed.length>27||!m.placed.every((v:unknown)=>Array.isArray(v)&&v.length===3&&v.every(n=>Number.isInteger(n)&&Number(n)>=-1&&Number(n)<=1))))return null;
 return m;
 }catch{return null;}
}
