import {Capacitor,registerPlugin,type PluginListenerHandle} from '@capacitor/core';
import {DuelRooms} from './room-server';
import type {ResultStorage} from './results';
interface TransportEvent {type:'message'|'disconnect'|'stopped';id:string;raw:string}
interface NativeHost {
 start():Promise<{address:string}>;stop():Promise<void>;advertise(o:{code:string}):Promise<void>;
 discover(o:{code:string}):Promise<{address:string}>;send(o:{id:string;raw:string}):Promise<void>;closePeer(o:{id:string}):Promise<void>;
 addListener(name:'transport',fn:(event:TransportEvent)=>void):Promise<PluginListenerHandle>;
}
const native=registerPlugin<NativeHost>('DuelHost');
export const androidDuels=()=>Capacitor.getPlatform()==='android';
export class AndroidDuelHost {
 private core:DuelRooms|null=null;private timer:ReturnType<typeof setInterval>|undefined;private listener:PluginListenerHandle|undefined;private code='';
 onStopped=()=>{};
 constructor(private storage?:ResultStorage){if(!storage)try{this.storage=localStorage;}catch{}}
 async start(){await this.stop();this.core=new DuelRooms({send:(id,m)=>{void native.send({id,raw:JSON.stringify(m)});},close:id=>{void native.closePeer({id});}},undefined,undefined,undefined,undefined,this.storage);
  this.listener=await native.addListener('transport',e=>{if(!this.core)return;if(e.type==='message')this.core.receive(e.id,e.raw);else if(e.type==='disconnect')this.core.disconnect(e.id);else{this.cleanup();this.onStopped();}});
  try{const result=await native.start();this.timer=setInterval(()=>this.core?.tick(),100);return result.address;}catch(e){await this.stop();throw e;}
 }
 async advertise(code:string){if(this.core&&this.code!==code){this.code=code;await native.advertise({code});}}
 private cleanup(){clearInterval(this.timer);this.timer=undefined;this.core=null;this.code='';void this.listener?.remove();this.listener=undefined;}
 async stop(){if(!this.core&&!this.listener)return;this.core?.shutdown();this.cleanup();await native.stop();}
 async discover(code:string){return (await native.discover({code})).address;}
}
