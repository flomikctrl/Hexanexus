/** Use the same Android media output as the audible background music. */
export class VictorySound {
 private audio=new Audio('/audio/victory.wav');
 private ready:Promise<void>|null=null;
 private unlocked=false;
 private playing=false;
 private generation=0;
 constructor(){this.audio.id='victory-audio';this.audio.preload='auto';this.audio.hidden=true;document.body.append(this.audio);this.audio.addEventListener('ended',()=>{this.playing=false;});}
 unlock(){
  if(this.unlocked)return Promise.resolve();if(this.ready)return this.ready;
  this.audio.muted=true;
  this.ready=this.audio.play().then(()=>{this.audio.pause();this.audio.currentTime=0;this.unlocked=true;}).catch(error=>{console.warn('Victory audio could not unlock',error);}).finally(()=>{this.audio.muted=false;this.ready=null;});return this.ready;
 }
 async play(volume:number){
  if(volume<=0||this.playing)return false;const generation=++this.generation;this.playing=true;
  await this.unlock();if(generation!==this.generation||!this.unlocked){this.playing=false;return false;}
  this.audio.volume=Math.min(1,volume/.4)*.85;this.audio.currentTime=0;
  try{await this.audio.play();return generation===this.generation;}catch(error){this.playing=false;console.warn('Victory audio playback failed',error);return false;}
 }
 stop(){this.generation++;if(this.playing){this.audio.pause();this.audio.currentTime=0;}this.playing=false;}
}
