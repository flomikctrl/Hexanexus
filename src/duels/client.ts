import {validDuelTask} from './generator';
import {validAward} from './results';
import {decodeCommand,duelAddress,type DuelCommand,type DuelServerMessage,type DuelState} from './protocol';
export function decodeServer(raw:string):DuelServerMessage|null {try{if(raw.length>32768)return null;const m=JSON.parse(raw);if(m?.v!==1)return null;
 if(m.type==='recovered')return m;
 if(m.type==='award')return validAward(m)?m:null;
 if(m.type==='error'||m.type==='closed')return typeof m.message==='string'&&m.message.length<=200?m:null;
 if(m.type==='session')return typeof m.playerId==='string'&&m.playerId.length<=80&&decodeCommand(JSON.stringify({v:1,type:'resume',code:m.code,token:m.token}))?m:null;
 if(m.type==='pong')return Number.isFinite(m.serverTime)&&Number.isFinite(m.sentAt)?m:null;
 if(m.type!=='state'||!/^\d{4}$/.test(m.code)||!Number.isSafeInteger(m.revision)||typeof m.matchId!=='string'||m.matchId.length>80||!Number.isInteger(m.round)||m.round<1||m.round>3||!Number.isFinite(m.serverTime)||!Number.isFinite(m.startAt)||!['lobby','preparing','countdown','playing','round-result','match-result','aborted'].includes(m.phase)||!Array.isArray(m.players)||m.players.length>2)return null;
 if(!m.players.every((p:unknown)=>{const v=p as DuelState['players'][0];return typeof v.id==='string'&&v.id.length<=80&&typeof v.connected==='boolean'&&typeof v.ready==='boolean'&&typeof v.prepared==='boolean'&&typeof v.next==='boolean'&&Number.isInteger(v.score)&&v.score>=0&&v.score<=2&&decodeCommand(JSON.stringify({v:1,type:'create',profile:v.profile}));}))return null;
 if(m.task&&!validDuelTask(m.task))return null;
 if(m.result&&(typeof m.result.reason!=='string'||m.result.reason.length>200||typeof m.result.technical!=='boolean'||!Number.isFinite(m.result.elapsedMs)||m.result.elapsedMs<0||m.result.winnerId!==null&&!m.players.some((p:{id:string})=>p.id===m.result.winnerId)))return null;
 return m;
}catch{return null;}}
export class DuelClient {
 state:DuelState|null=null;playerId='';offset=0;connected=false;
 private socket:WebSocket|null=null;private session:{code:string;token:string}|null=null;private timer:ReturnType<typeof setTimeout>|undefined;private pulse:ReturnType<typeof setInterval>|undefined;private attempts=0;private stopped=true;private url='';private first:DuelCommand|null=null;
 onMessage:(m:DuelServerMessage)=>void=()=>{};onStatus:(text:string)=>void=()=>{};
 private identity='';
 constructor(private storage?:Pick<Storage,'getItem'|'setItem'>){try{if(storage){const key='hexanexus.duels.identity.v1';let value=storage.getItem(key);if(!value||!/^[a-f0-9]{64}$/.test(value)){value=Array.from(crypto.getRandomValues(new Uint8Array(32)),n=>n.toString(16).padStart(2,'0')).join('');storage.setItem(key,value);}this.identity=value;}}catch{}}
 recoverSaved(){try{const address=this.storage?.getItem('hexanexus.duels.last-host.v1');if(address&&this.identity)return this.connect(address,{v:1,type:'recover',token:this.identity});}catch{}return false;}
 private retryUntil=0;
 private fail(message:string){this.stop();this.onStatus(message);this.onMessage({v:1,type:'closed',message});}
 connect(address:string,command:DuelCommand){const url=duelAddress(address);if(!url){this.onStatus('Введите локальный адрес хоста, например 192.168.0.10:8787');return false;}this.stop();this.stopped=false;this.url=url;this.first=this.identity&&['create','join'].includes(command.type)?{...command,identity:this.identity} as DuelCommand:command;this.attempts=0;this.open(false);return true;}
 private open(resume:boolean){
  this.onStatus(resume?'Переподключение…':'Подключение…');const s=this.socket=new WebSocket(this.url);let timeout=setTimeout(()=>s.close(),5000);
  s.onopen=()=>{clearTimeout(timeout);if(this.socket!==s)return;this.connected=true;this.attempts=0;this.onStatus('Подключено');if(this.identity&&this.first?.type!=='recover')this.send({v:1,type:'recover',token:this.identity});if(resume&&this.session)this.send({v:1,type:'resume',...this.session});else if(this.first)this.send(this.first);this.pulse=setInterval(()=>this.send({v:1,type:'ping',sentAt:Date.now()}),4000);};
  s.onmessage=e=>{if(this.socket!==s||typeof e.data!=='string')return;const m=decodeServer(e.data);if(!m){this.fail('Несовместимая версия сервера');return;}if(m.type==='error'&&resume){this.onMessage({v:1,type:'closed',message:m.message});this.stop();return;}if(m.type==='recovered'&&this.first?.type==='recover'){this.stop();return;}if(m.type==='session'){try{this.storage?.setItem('hexanexus.duels.last-host.v1',this.url);}catch{}this.retryUntil=0;this.session={code:m.code,token:m.token};this.playerId=m.playerId;}if(m.type==='state'){if(this.state&&m.code===this.state.code&&m.revision<this.state.revision)return;this.offset=m.serverTime-Date.now();this.state=m;}if(m.type==='pong')this.offset=m.serverTime+(Date.now()-m.sentAt)/2-Date.now();this.onMessage(m);if(m.type==='closed')this.stop();};
  s.onerror=()=>this.onStatus('Сервер недоступен. Проверьте адрес хоста, Wi-Fi и брандмауэр.');
  s.onclose=()=>{clearTimeout(timeout);if(this.socket!==s)return;this.connected=false;clearInterval(this.pulse);if(this.stopped)return;this.onStatus('Соединение потеряно');if(this.session){if(!this.retryUntil)this.retryUntil=Date.now()+25000;if(Date.now()<this.retryUntil){this.attempts++;this.timer=setTimeout(()=>{if(Date.now()<this.retryUntil)this.open(true);else this.fail('Не удалось восстановить связь. Подключитесь к комнате заново.');},Math.min(3000,500*this.attempts));return;}}this.fail('Не удалось восстановить связь. Подключитесь к комнате заново.');};
 }
 send(m:DuelCommand){if(this.socket?.readyState!==WebSocket.OPEN)return false;this.socket.send(JSON.stringify(m));return true;}
 action(type:'prepared'|'next'|'rematch'){if(this.state)this.send({v:1,type,matchId:this.state.matchId,round:this.state.round});}
 stop(){this.stopped=true;this.retryUntil=0;clearTimeout(this.timer);clearInterval(this.pulse);const socket=this.socket;this.socket=null;socket?.close();this.connected=false;this.state=null;this.session=null;this.playerId='';}
 leave(){this.send({v:1,type:'leave'});this.stop();}
}
