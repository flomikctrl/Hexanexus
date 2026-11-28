import {afterEach,beforeEach,describe,it,expect,vi} from 'vitest';
const mock=vi.hoisted(()=>({start:vi.fn(),stop:vi.fn(),advertise:vi.fn(),discover:vi.fn(),send:vi.fn(),closePeer:vi.fn(),addListener:vi.fn(),remove:vi.fn(),event:null as null|((e:{type:string;id:string;raw:string})=>void)}));
vi.mock('@capacitor/core',()=>({Capacitor:{getPlatform:()=> 'android'},registerPlugin:()=>mock}));
import {AndroidDuelHost,androidDuels} from './android-host';
describe('Android native transport uses the shared room engine',()=>{
 let host:AndroidDuelHost;
 beforeEach(()=>{vi.useFakeTimers();vi.clearAllMocks();mock.start.mockResolvedValue({address:'192.168.0.102:50001'});mock.stop.mockResolvedValue(undefined);mock.addListener.mockImplementation(async(_n,fn)=>{mock.event=fn;return {remove:mock.remove};});host=new AndroidDuelHost();});
 afterEach(async()=>{await host.stop();vi.useRealTimers();});
 it('starts a phone host, validates network messages and tears down',async()=>{expect(androidDuels()).toBe(true);expect(await host.start()).toBe('192.168.0.102:50001');mock.event!({type:'message',id:'peer',raw:'invalid'});expect(mock.send).toHaveBeenCalledWith({id:'peer',raw:expect.stringContaining('error')});await host.stop();expect(mock.stop).toHaveBeenCalledOnce();expect(mock.remove).toHaveBeenCalledOnce();expect(vi.getTimerCount()).toBe(0);});
 it('advertises once, discovers a room, and notifies native shutdown',async()=>{await host.start();await host.advertise('1234');await host.advertise('1234');expect(mock.advertise).toHaveBeenCalledOnce();mock.discover.mockResolvedValue({address:'192.168.0.109:50002'});expect(await host.discover('1234')).toBe('192.168.0.109:50002');const stopped=vi.fn();host.onStopped=stopped;mock.event!({type:'stopped',id:'',raw:''});expect(stopped).toHaveBeenCalledOnce();expect(vi.getTimerCount()).toBe(0);});
 it('cleans listeners after a native startup failure',async()=>{mock.start.mockRejectedValue(new Error('No Wi-Fi'));await expect(host.start()).rejects.toThrow('No Wi-Fi');expect(mock.remove).toHaveBeenCalledOnce();expect(mock.stop).toHaveBeenCalledOnce();expect(vi.getTimerCount()).toBe(0);});
 it('ignores a late native stopped event after leaving the room',async()=>{await host.start();const stopped=vi.fn();host.onStopped=stopped;await host.stop();mock.event!({type:'stopped',id:'',raw:''});expect(stopped).not.toHaveBeenCalled();});
});
