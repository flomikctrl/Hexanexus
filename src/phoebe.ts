import './phoebe.css';
import {PhoebeController,readPhoebeSetting,savePhoebeSetting,type PhoebeEmotion,type PhoebeEvent,type PhoebeState} from './phoebe-state';
import {PhoebeSpriteSwitcher,type PhoebeSprite} from './phoebe-sprite';

type ManagedRoot=HTMLElement&{disposePhoebe?:()=>void};
export class PhoebeAssistant {
  private root=document.createElement('aside');
  private button=document.createElement('button');
  private image=document.createElement('img');
  private bubble=document.createElement('p');
  private controller:PhoebeController;
  private sprites=new Map<PhoebeEmotion,PhoebeSprite>();
  private spriteSwitcher:PhoebeSpriteSwitcher;
  private listeners=new AbortController();
  private disposed=false;
  private renderVersion=0;
  private screen='home';
  private footer:HTMLElement;
  private setting:HTMLInputElement;
  private ready=false;
  private failed=false;
  private observer:ResizeObserver;
  private layoutFrame=0;
  constructor(){
    // A new mount replaces the old owner, including its timers and listeners.
    document.querySelectorAll<ManagedRoot>('#phoebe').forEach(root=>{root.disposePhoebe?.();root.remove();});
    document.querySelectorAll('.phoebe-setting,#phoebe-asset-warning').forEach(node=>node.remove());
    this.root.id='phoebe';this.root.className='phoebe';this.root.setAttribute('aria-label','Фиби — помощница мастерской');this.root.hidden=true;
    this.bubble.id='phoebe-speech';this.bubble.className='phoebe-speech';this.bubble.setAttribute('role','status');this.bubble.setAttribute('aria-live','polite');this.bubble.hidden=true;
    this.button.type='button';this.button.className='phoebe-character';this.button.title='Поговорить с Фиби';this.button.setAttribute('aria-label','Поговорить с Фиби');
    this.image.draggable=false;this.image.decoding='sync';this.image.hidden=true;this.image.alt='Фиби-чоби';this.button.replaceChildren(this.image);this.root.replaceChildren(this.bubble,this.button);document.body.append(this.root);
    this.spriteSwitcher=new PhoebeSpriteSwitcher(this.image,sprite=>{this.button.style.clipPath=sprite.clip;});
    this.footer=document.querySelector('.game-footer')!;
    document.getElementById('pause-levels')!.insertAdjacentHTML('beforebegin','<label class="phoebe-setting"><input type="checkbox" id="phoebe-enabled"> Показывать Фиби</label><p id="phoebe-asset-warning" hidden role="status"></p>');
    this.setting=document.getElementById('phoebe-enabled') as HTMLInputElement;
    let enabled=true;try{enabled=readPhoebeSetting(localStorage);}catch{}
    this.setting.checked=enabled;this.controller=new PhoebeController(enabled,state=>this.render(state));
    const options={signal:this.listeners.signal};
    this.setting.addEventListener('change',()=>{this.controller.setEnabled(this.setting.checked);try{savePhoebeSetting(localStorage,this.setting.checked);}catch{}},options);
    for(const type of ['pointerdown','pointerup','dblclick','contextmenu'])this.button.addEventListener(type,event=>event.stopPropagation(),options);
    this.button.addEventListener('click',event=>{event.stopPropagation();this.notify({type:'manual'});},options);
    this.observer=new ResizeObserver(()=>this.scheduleLayout());this.observer.observe(this.footer);this.observer.observe(document.getElementById('toast')!);window.addEventListener('resize',()=>this.scheduleLayout(),options);
    for(const id of ['victory','campaign-complete'])document.getElementById(id)!.addEventListener('close',()=>{this.mount(null);this.render(this.controller.state);},options);
    (this.root as ManagedRoot).disposePhoebe=()=>this.dispose();
    void this.loadSprites();
  }
  private async loadSprites(){
    try{
      await Promise.all((['IDLE','SAD','SHOCK'] as const).map(async emotion=>{
        const src=`/phoebe/phoebe-${emotion.toLowerCase()}.png`,image=new Image();image.src=src;await image.decode();
        const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
        const ctx=canvas.getContext('2d',{willReadFrequently:true});if(!ctx)throw Error('Не удалось прочитать прозрачность спрайта.');ctx.drawImage(image,0,0);
        const {data}=ctx.getImageData(0,0,canvas.width,canvas.height);let transparent=false;const left:string[]=[],right:string[]=[];
        // Clip the clickable element to its alpha silhouette, so transparent
        // corners pass input straight through to the canvas underneath.
        for(let y=0;y<canvas.height;y+=3){let l=canvas.width,r=-1;for(let x=0;x<canvas.width;x++){if(data[(y*canvas.width+x)*4+3]>32){l=Math.min(l,x);r=x;}else transparent=true;}if(r>=l){left.push(`${l/canvas.width*100}% ${y/canvas.height*100}%`);right.push(`${(r+1)/canvas.width*100}% ${y/canvas.height*100}%`);}}
        if(!transparent||!left.length)throw Error(`У спрайта ${src} нет прозрачного фона.`);
        this.sprites.set(emotion,{src,clip:`polygon(${[...left,...right.reverse()].join(',')})`});
      }));
      if(this.disposed)return;
      this.ready=true;this.root.dataset.assets='ready';this.render(this.controller.state);
    }catch(error){
      this.failSprites(error);
    }
  }
  private failSprites(error:unknown){
    if(this.disposed)return;
    this.failed=true;this.controller.setEnabled(false);this.setting.disabled=true;this.root.hidden=true;
    const warning=document.getElementById('phoebe-asset-warning')!;warning.hidden=false;warning.textContent='Не удалось загрузить прозрачные PNG Фиби из public/phoebe. Помощница временно недоступна.';console.warn('Фиби:',error);
  }
  notify(event:PhoebeEvent){
    if(this.disposed)return false;
    const accepted=this.controller.notify(event);
    if(accepted&&(event.type==='level-win'||event.type==='game-win')){this.mount(document.getElementById(event.type==='game-win'?'campaign-complete':'victory') as HTMLDialogElement);this.render(this.controller.state);}
    return accepted;
  }
  setScreen(screen:string){if(this.disposed)return;this.screen=screen;if(screen==='editor')this.controller.reset();if(this.root.parentElement instanceof HTMLDialogElement&&!this.root.parentElement.open)this.mount(null);this.render(this.controller.state);}
  private mount(dialog:HTMLDialogElement|null){
    this.root.classList.toggle('phoebe--dialog',!!dialog);
    if(dialog){dialog.insertBefore(this.root,dialog.querySelector('button'));}else document.body.append(this.root);
    this.scheduleLayout();
  }
  private render(state:PhoebeState){
    if(this.disposed)return;
    const version=++this.renderVersion;
    this.root.hidden=!state.enabled||!this.ready||this.failed||this.screen==='editor';
    if(this.root.hidden){this.spriteSwitcher.cancel();this.bubble.textContent='';this.bubble.hidden=true;this.root.dataset.animation='idle';if(this.layoutFrame)cancelAnimationFrame(this.layoutFrame);this.layoutFrame=0;return;}
    this.root.dataset.emotion=state.emotion;
    const sprite=this.sprites.get(state.emotion)!;
    const replacing=this.image.hidden||this.image.getAttribute('src')!==sprite.src;
    const restart=replacing||this.root.dataset.animation!==state.animation||!!state.message&&this.bubble.textContent!==state.message;
    if(replacing)this.button.style.animation='none';
    void this.spriteSwitcher.show(sprite).then(shown=>{
      if(!shown||this.disposed||version!==this.renderVersion||this.root.hidden)return;
      this.root.dataset.animation=state.animation;
      if(restart){this.button.style.animation='none';void this.button.offsetWidth;this.button.style.removeProperty('animation');}
      this.scheduleLayout();
    }).catch(error=>this.failSprites(error));
    this.image.alt=state.emotion==='SAD'?'Грустная Фиби-чоби':state.emotion==='SHOCK'?'Удивлённая Фиби-чоби':'Фиби-чоби';
    this.bubble.textContent=state.message;this.bubble.hidden=!state.message;this.scheduleLayout();
  }
  private scheduleLayout(){
    if(this.disposed||this.root.hidden||this.layoutFrame)return;
    this.layoutFrame=requestAnimationFrame(()=>{this.layoutFrame=0;this.layout();});
  }
  private layout(){
    if(this.root.hidden||this.root.classList.contains('phoebe--dialog'))return;
    let bottom=this.screen==='home'?46:18;const mobile=innerWidth<=650,size=mobile?100:175;
    const height=size,width=size*1.09,right=mobile?12:20;
    if(this.screen==='game'){
      for(const obstacle of [this.footer,document.getElementById('toast')!]){
        const rect=obstacle.getBoundingClientRect();
        if(rect.width&&innerWidth-right-width<rect.right&&innerWidth-right>rect.left&&innerHeight-bottom>rect.top&&innerHeight-bottom-height<rect.bottom)bottom=Math.max(bottom,innerHeight-rect.top+14);
      }
    }
    this.root.style.setProperty('--phoebe-bottom',`${bottom}px`);this.root.style.setProperty('--phoebe-size',`${height}px`);
  }
  dispose(){
    if(this.disposed)return;
    this.disposed=true;this.renderVersion++;this.controller.dispose();this.spriteSwitcher.dispose();this.listeners.abort();this.observer.disconnect();
    if(this.layoutFrame)cancelAnimationFrame(this.layoutFrame);this.layoutFrame=0;
    this.setting.closest('.phoebe-setting')?.remove();document.getElementById('phoebe-asset-warning')?.remove();this.root.remove();
  }
}
