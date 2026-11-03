export class BackgroundMusic {
  private audio=new Audio('/audio/silhouette-loop.wav');
  private enabled=true;
  private volume=.15;
  private unlocked=false;
  private controls:HTMLElement[]=[];
  private failed=false;
  constructor(){
    try{const saved=JSON.parse(localStorage.getItem('hexanexus.music')||'null');
      if(typeof saved?.enabled==='boolean')this.enabled=saved.enabled;
      if(typeof saved?.volume==='number'&&Number.isFinite(saved.volume))this.volume=Math.max(0,Math.min(.4,saved.volume));
    }catch{}
    this.audio.loop=true;this.audio.preload='none';this.audio.volume=this.volume;
    this.audio.hidden=true;document.body.append(this.audio);
    // Invoke play synchronously from a real gesture, then retry if autoplay is blocked.
    const unlock=()=>{this.unlocked=true;void this.play();};
    document.addEventListener('pointerdown',unlock,{passive:true});
    document.addEventListener('keydown',unlock);
    document.addEventListener('visibilitychange',()=>{if(document.hidden)this.audio.pause();else void this.play();});
    this.audio.addEventListener('error',()=>{this.failed=true;this.refresh();});
  }
  mount(host:HTMLElement){
    const row=document.createElement('div');row.className='music-settings';
    row.innerHTML='<button type="button" class="music-toggle"></button><label>Громкость<input class="music-volume" type="range" min="0" max="0.4" step="0.05" aria-label="Громкость фоновой музыки"></label>';
    row.querySelector<HTMLButtonElement>('button')!.onclick=()=>{
      this.enabled=!this.enabled;this.unlocked=true;this.save();
      if(this.enabled)void this.play();else this.audio.pause();this.refresh();
    };
    row.querySelector<HTMLInputElement>('input')!.oninput=e=>{this.volume=Number((e.target as HTMLInputElement).value);this.audio.volume=this.volume;this.save();this.refresh();};
    this.controls.push(row);host.append(row);this.refresh();
  }
  private async play(){
    if(!this.enabled||!this.unlocked||document.hidden||this.failed)return;
    try{await this.audio.play();}catch{/* A later user gesture can retry without an error popup. */}
  }
  private save(){try{localStorage.setItem('hexanexus.music',JSON.stringify({enabled:this.enabled,volume:this.volume}));}catch{}}
  private refresh(){for(const row of this.controls){
    const button=row.querySelector<HTMLButtonElement>('button')!;
    button.textContent=this.failed?'♪ Недоступна':this.enabled?'♪ Музыка':'♪ Без музыки';
    button.title=this.enabled?'Выключить фоновую музыку':'Включить фоновую музыку';button.disabled=this.failed;
    button.setAttribute('aria-pressed',String(this.enabled&&!this.failed));
    const input=row.querySelector<HTMLInputElement>('input')!;input.value=String(this.volume);input.disabled=this.failed;
  }}
}
