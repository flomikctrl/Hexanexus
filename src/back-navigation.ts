export interface BackPort {
 closeModal:()=>boolean;closeMenu:()=>boolean;screen:()=>string;
 home:()=>void;pause:()=>void;hintExit:()=>void;exit:()=>void;
}
export class BackNavigation {
 private exitArmedAt:number|null=null;
 constructor(private port:BackPort,private now:()=>number=()=>performance.now()){}
 reset(){this.exitArmedAt=null;}
 handle(system=true){
  if(this.port.closeModal()){this.reset();return true;}
  if(this.port.closeMenu()){this.reset();return true;}
  const screen=this.port.screen();
  if(screen==='game'||screen==='editor'){this.reset();this.port.pause();return true;}
  if(screen!=='home'){this.reset();this.port.home();return true;}
  if(!system)return false;
  const now=this.now();if(this.exitArmedAt!==null&&now-this.exitArmedAt>=0&&now-this.exitArmedAt<=2000){this.reset();this.port.exit();}
  else{this.exitArmedAt=now;this.port.hintExit();}return true;
 }
}
export interface ListenerHandle {remove:()=>Promise<void>}
export interface AndroidEvents {back:(fn:()=>void)=>Promise<ListenerHandle>;pause:(fn:()=>void)=>Promise<ListenerHandle>;resume:(fn:()=>void)=>Promise<ListenerHandle>}
export class AndroidBackBinding {
 private pending:Promise<ListenerHandle[]>|null=null;private disposed=false;
 constructor(private events:AndroidEvents,private nav:BackNavigation,private active:(value:boolean)=>void){}
 start(){if(this.disposed)return Promise.resolve();if(!this.pending)this.pending=Promise.all([this.events.back(()=>this.nav.handle()),this.events.pause(()=>{this.nav.reset();this.active(false);}),this.events.resume(()=>{this.nav.reset();this.active(true);})]);return this.pending.then(()=>{});}
 async dispose(){if(this.disposed)return;this.disposed=true;const handles=await this.pending??[];await Promise.all(handles.map(handle=>handle.remove()));}
}
