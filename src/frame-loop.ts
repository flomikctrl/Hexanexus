export class FrameLoop {
 private id:number|null=null;private active=false;private disposed=false;
 constructor(private draw:(time:number)=>void,private request:(cb:FrameRequestCallback)=>number=cb=>requestAnimationFrame(cb),private cancel:(id:number)=>void=id=>cancelAnimationFrame(id)){}
 start(){if(this.active||this.disposed)return;this.active=true;this.queue();}
 private queue(){if(this.active&&!this.disposed&&this.id===null)this.id=this.request(this.tick);}
 private tick=(time:number)=>{this.id=null;if(!this.active||this.disposed)return;this.draw(time);this.queue();};
 pause(){this.active=false;if(this.id!==null){this.cancel(this.id);this.id=null;}}
 dispose(){this.pause();this.disposed=true;}
}
