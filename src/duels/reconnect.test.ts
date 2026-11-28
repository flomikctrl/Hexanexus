import {it,expect,vi,afterEach} from 'vitest';
import {DuelClient} from './client';
class Socket {
 static OPEN=1;static sockets:Socket[]=[];readyState=0;
 onopen=()=>{};onclose=()=>{};onerror=()=>{};onmessage=(_e:{data:string})=>{};
 constructor(_url:string){Socket.sockets.push(this);}
 send(_raw:string){}close(){this.readyState=3;this.onclose();}
 open(){this.readyState=1;this.onopen();}
 receive(m:unknown){this.onmessage({data:JSON.stringify(m)});}
}
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();Socket.sockets=[];});
function connect(){vi.useFakeTimers();vi.stubGlobal('WebSocket',Socket);const c=new DuelClient();c.connect('192.168.0.102:5555',{v:1,type:'create',profile:{name:'Test',skin:'classic',emotion:'IDLE'}});const s=Socket.sockets.at(-1)!;s.open();s.receive({v:1,type:'session',playerId:'p',code:'1234',token:'a'.repeat(64)});return c;}
it('keeps retrying after five quick Wi-Fi failures and restores the same session',()=>{const c=connect();Socket.sockets.at(-1)!.close();for(const delay of [500,1000,1500,2000,2500]){vi.advanceTimersByTime(delay);Socket.sockets.at(-1)!.close();}vi.advanceTimersByTime(3000);const latest=Socket.sockets.at(-1)!;latest.open();latest.receive({v:1,type:'session',playerId:'p',code:'1234',token:'a'.repeat(64)});expect(c.connected).toBe(true);expect(c.playerId).toBe('p');c.stop();expect(vi.getTimerCount()).toBe(0);});
it('announces terminal connection failure to the UI instead of leaving the playing screen stuck',()=>{const c=connect(),messages=vi.fn();c.onMessage=messages;Socket.sockets.at(-1)!.close();vi.advanceTimersByTime(40000);expect(messages).toHaveBeenCalledWith(expect.objectContaining({type:'closed'}));expect(c.state).toBeNull();expect(c.connected).toBe(false);expect(vi.getTimerCount()).toBe(0);});
it('keeps a durable identity and requests old results after an application restart',()=>{vi.useFakeTimers();vi.stubGlobal('WebSocket',Socket);const values=new Map<string,string>(),storage={getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>{values.set(k,v);}};const first=new DuelClient(storage);first.connect('192.168.0.102:5555',{v:1,type:'create',profile:{name:'Test',skin:'classic',emotion:'IDLE'}});const s=Socket.sockets.at(-1)!;s.open();s.receive({v:1,type:'session',code:'1234',playerId:'p',token:values.get('hexanexus.duels.identity.v1')});first.stop();const identity=values.get('hexanexus.duels.identity.v1'),restored=new DuelClient(storage);expect(restored.recoverSaved()).toBe(true);const next=Socket.sockets.at(-1)!,sent=vi.spyOn(next,'send');next.open();expect(sent).toHaveBeenCalledWith(JSON.stringify({v:1,type:'recover',token:identity}));next.receive({v:1,type:'recovered'});expect(vi.getTimerCount()).toBe(0);expect(values.get('hexanexus.duels.identity.v1')).toBe(identity);});
