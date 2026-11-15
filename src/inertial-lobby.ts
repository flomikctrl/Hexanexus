export const lobbyMotion={sensitivity:.008,maxSpeed:5,friction:3,stopSpeed:.015,idleDelay:900,autoSpeed:.13,autoTime:.65} as const;
// Only the decorative group's yaw is owned here. Camera and puzzle are absent.
export class LobbyRotation {
 active=false;yaw=-.25;readonly pitch=0;velocity=0;
 private pointer:{id:number;x:number;time:number}|null=null;
 private lastFrame:number|null=null;
 private idleSince=0;
 private suspended=false;
 private autoVelocity=0;
 private direction=1;
 get dragging(){return this.pointer!==null;}
 get coasting(){return !this.dragging&&Math.abs(this.velocity)>=lobbyMotion.stopSpeed;}
 setActive(active:boolean,now:number){if(this.active===active)return;this.active=active;this.cancel(now);}
 suspend(value:boolean,now:number){if(this.suspended===value)return;this.suspended=value;this.cancel(now);}
 begin(id:number,x:number,_y:number,now:number){if(!this.active||this.suspended||this.pointer)return false;this.cancel(now);this.pointer={id,x,time:now};return true;}
 move(id:number,x:number,_y:number,now:number){
  const p=this.pointer;if(!p||p.id!==id)return false;
  const dx=x-p.x,dt=Math.max(.001,(now-p.time)/1000),raw=Math.max(-lobbyMotion.maxSpeed,Math.min(lobbyMotion.maxSpeed,dx*lobbyMotion.sensitivity/dt));
  this.yaw+=dx*lobbyMotion.sensitivity;this.velocity+=(raw-this.velocity)*(1-Math.exp(-dt/.045));
  if(dx)this.direction=Math.sign(dx);this.pointer={id,x,time:now};this.idleSince=now;return true;
 }
 end(id:number,now:number){if(this.pointer?.id!==id)return;this.velocity*=Math.exp(-Math.max(0,now-this.pointer.time)/60);if(Math.abs(this.velocity)<lobbyMotion.stopSpeed)this.velocity=0;this.pointer=null;this.idleSince=now;}
 cancel(now:number){this.pointer=null;this.velocity=0;this.autoVelocity=0;this.idleSince=now;this.lastFrame=null;}
 step(now:number,reduced=false){
  const previous=this.lastFrame;this.lastFrame=now;
  if(!this.active||this.suspended||this.dragging)return;
  if(reduced){this.velocity=0;this.autoVelocity=0;return;}
  const dt=previous===null?0:Math.max(0,Math.min((now-previous)/1000,.1));if(!dt)return;
  let remaining=dt;
  if(this.coasting){
   const t=Math.min(dt,Math.log(Math.abs(this.velocity)/lobbyMotion.stopSpeed)/lobbyMotion.friction),decay=Math.exp(-lobbyMotion.friction*t);
   this.yaw+=this.velocity*(1-decay)/lobbyMotion.friction;this.velocity*=decay;remaining-=t;
   if(t<dt||Math.abs(this.velocity)<=lobbyMotion.stopSpeed*1.000001){this.velocity=0;this.idleSince=now-remaining*1000;}
  }
  if(!this.coasting){
   const t=Math.min(remaining,Math.max(0,(now-this.idleSince-lobbyMotion.idleDelay)/1000)),target=this.direction*lobbyMotion.autoSpeed,e=Math.exp(-t/lobbyMotion.autoTime);
   this.yaw+=target*t+(this.autoVelocity-target)*lobbyMotion.autoTime*(1-e);this.autoVelocity=target+(this.autoVelocity-target)*e;
  }
 }
}
