import {describe,it,expect,vi} from 'vitest';
import {BackNavigation,AndroidBackBinding} from './back-navigation';
import {ArcadeSession} from './arcade';
function fixture(){let screen='home',modal=false,menu=false,now=0;const calls:string[]=[];const nav=new BackNavigation({closeModal:()=>{if(!modal)return false;modal=false;calls.push('modal');return true;},closeMenu:()=>{if(!menu)return false;menu=false;calls.push('menu');return true;},screen:()=>screen,home:()=>{screen='home';calls.push('home');},pause:()=>{modal=true;calls.push('pause');},hintExit:()=>calls.push('hint'),exit:()=>calls.push('exit')},()=>now);return {nav,calls,setScreen:(s:string)=>{screen=s;nav.reset();},modal:()=>{modal=true;},menu:()=>{menu=true;},time:(n:number)=>{now=n;}};}
describe('system Back priorities',()=>{
 it('closes a modal before the menu and never exits',()=>{const f=fixture();f.menu();f.modal();f.nav.handle();f.nav.handle();expect(f.calls).toEqual(['modal','menu']);});
 it.each(['levels','achievements','wardrobe'])('returns from %s to home',s=>{const f=fixture();f.setScreen(s);f.nav.handle();expect(f.calls).toEqual(['home']);});
 it('opens pause during a game, and routes another Back to that modal',()=>{const f=fixture();f.setScreen('game');f.nav.handle();f.nav.handle();expect(f.calls).toEqual(['pause','modal']);});
 it('one home press only shows the small exit message',()=>{const f=fixture();f.nav.handle();expect(f.calls).toEqual(['hint']);});
 it('a second home press within two seconds exits',()=>{const f=fixture();f.nav.handle();f.time(1999);f.nav.handle();expect(f.calls).toEqual(['hint','exit']);});
 it('an expired press starts a new exit window',()=>{const f=fixture();f.nav.handle();f.time(2001);f.nav.handle();expect(f.calls).toEqual(['hint','hint']);});
 it('navigation resets the exit arm',()=>{const f=fixture();f.nav.handle();f.setScreen('levels');f.nav.handle();f.time(500);f.nav.handle();expect(f.calls).toEqual(['hint','home','hint']);});
 it('modal/menu dismissal resets the exit arm',()=>{const f=fixture();f.nav.handle();f.menu();f.nav.handle();f.nav.handle();expect(f.calls).toEqual(['hint','menu','hint']);});
 it('Escape in a browser never arms or performs exit',()=>{const f=fixture();expect(f.nav.handle(false)).toBe(false);expect(f.calls).toEqual([]);});
 it('pauses an actual arcade timer without losing time/lives, then resumes once',()=>{
  let now=0,modal=false;const session=ArcadeSession.create(44,undefined,()=>now);session.resume();const s=structuredClone(session.state);let resumes=0;
  const nav=new BackNavigation({closeModal:()=>{if(!modal)return false;modal=false;session.resume();resumes++;return true;},closeMenu:()=>false,screen:()=> 'game',home:()=>{},pause:()=>{session.pause(false);modal=true;},hintExit:()=>{},exit:()=>{throw Error('Game must not exit');}},()=>now);
  nav.handle();now=90000;session.tick();expect(session.state.remainingMs).toBe(s.remainingMs);expect(session.state.lives).toBe(s.lives);expect(session.state.paused).toBe(true);nav.handle();expect(resumes).toBe(1);now+=150;session.tick();expect(session.state.remainingMs).toBe(s.remainingMs-150);expect(session.state.lives).toBe(3);
 });
 it('registers native Back only once and removes listeners on disposal',async()=>{const f=fixture(),back=vi.fn(async()=>({remove:vi.fn(async()=>{})})),pause=vi.fn(async()=>({remove:vi.fn(async()=>{})})),resume=vi.fn(async()=>({remove:vi.fn(async()=>{})}));const b=new AndroidBackBinding({back,pause,resume},f.nav,()=>{});await Promise.all([b.start(),b.start(),b.start()]);expect(back).toHaveBeenCalledTimes(1);expect(pause).toHaveBeenCalledTimes(1);expect(resume).toHaveBeenCalledTimes(1);await b.dispose();await b.start();expect(back).toHaveBeenCalledTimes(1);});
});
