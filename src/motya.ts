import './motya.css';
import {PhoebeController,readPhoebeSetting,savePhoebeSetting,type PhoebeEvent,type PhoebeState} from './phoebe-state';
import {PhoebeSpriteSwitcher,type PhoebeSprite} from './phoebe-sprite';
import {readMotyaSkin,saveMotyaSkin,skinSprite,skinIds,skinStorageKey,type MotyaSkinId,type MotyaEmotion} from './motya-skins';

type SpriteSet=Map<MotyaEmotion,PhoebeSprite>;
type ManagedRoot=HTMLElement&{disposeMotya?:()=>void;disposePhoebe?:()=>void};
export class MotyaAssistant {
  private root=document.createElement('aside');
  private button=document.createElement('button');
  private image=document.createElement('img');
  private bubble=document.createElement('p');
  private controller:PhoebeController;
  private spriteSwitcher:PhoebeSpriteSwitcher;
  private cache=new Map<MotyaSkinId,Promise<SpriteSet>>();
  private listeners=new AbortController();
  private disposed=false;
  private renderVersion=0;
  private screen='home';
  private footer:HTMLElement;
  private setting:HTMLInputElement;
  private observer:ResizeObserver;
  private layoutFrame=0;
  private activeSkin:MotyaSkinId='classic';
  private preview:{skin:MotyaSkinId;emotion:MotyaEmotion}|null=null;
  get skin(){return this.activeSkin;}
  constructor(private canWear:(skin:MotyaSkinId)=>boolean=skin=>skin==='classic',persistMigration=true){
    document.querySelectorAll<ManagedRoot>('#motya,#phoebe').forEach(root=>{root.disposeMotya?.();root.disposePhoebe?.();root.remove();});
    document.querySelectorAll('.motya-setting,#motya-asset-warning').forEach(node=>node.remove());
    try{this.activeSkin=readMotyaSkin(localStorage,this.canWear('royal'),skinIds.filter(this.canWear));
      if(persistMigration&&localStorage.getItem(skinStorageKey)!==this.activeSkin)saveMotyaSkin(localStorage,this.activeSkin,this.canWear('royal'),skinIds.filter(this.canWear));}catch{}
    this.root.id='motya';this.root.className='motya';this.root.setAttribute('aria-label','Мотя — плюшевая помощница');this.root.hidden=true;
    this.bubble.className='motya-speech';this.bubble.setAttribute('role','status');this.bubble.setAttribute('aria-live','polite');this.bubble.hidden=true;
    this.button.type='button';this.button.className='motya-character';this.button.title='Поговорить с Мотей';this.button.setAttribute('aria-label','Поговорить с Мотей');
    this.image.draggable=false;this.image.decoding='async';this.image.hidden=true;this.image.alt='Мотя';
    this.button.append(this.image);this.root.append(this.bubble,this.button);document.body.append(this.root);
    this.spriteSwitcher=new PhoebeSpriteSwitcher(this.image,sprite=>{this.button.style.clipPath=sprite.clip;});
    this.footer=document.querySelector('.game-footer')!;
    document.getElementById('mascot-settings')!.innerHTML='<label class="motya-setting"><input type="checkbox" id="motya-enabled"> Показывать Мотю</label><p id="motya-asset-warning" hidden role="status"></p>';
    this.setting=document.getElementById('motya-enabled') as HTMLInputElement;
    let enabled=true;try{enabled=readPhoebeSetting(localStorage);}catch{}
    this.setting.checked=enabled;this.controller=new PhoebeController(enabled,state=>this.render(state));
    const options={signal:this.listeners.signal};
    this.setting.addEventListener('change',()=>{this.controller.setEnabled(this.setting.checked);try{savePhoebeSetting(localStorage,this.setting.checked);}catch{}},options);
    for(const type of ['pointerdown','pointerup','dblclick','contextmenu'])this.button.addEventListener(type,e=>e.stopPropagation(),options);
    this.button.addEventListener('click',e=>{e.stopPropagation();if(!this.preview)this.notify({type:'manual'});},options);
    this.observer=new ResizeObserver(()=>this.scheduleLayout());this.observer.observe(this.footer);this.observer.observe(document.getElementById('toast')!);
    window.addEventListener('resize',()=>this.scheduleLayout(),options);
    for(const id of ['victory','campaign-complete'])document.getElementById(id)!.addEventListener('close',()=>{this.mount(null);this.render(this.controller.state);},options);
    (this.root as ManagedRoot).disposeMotya=()=>this.dispose();this.render(this.controller.state);
  }
  private loadSprites(skin:MotyaSkinId):Promise<SpriteSet>{
    const cached=this.cache.get(skin);if(cached)return cached;
    const loading=Promise.all((['IDLE','SAD','SHOCK'] as const).map(async emotion=>{
      const src=skinSprite(skin,emotion),image=new Image();image.src=src;await image.decode();
      const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
      const ctx=canvas.getContext('2d',{willReadFrequently:true});if(!ctx)throw Error('Не удалось прочитать PNG Моти.');
      ctx.drawImage(image,0,0);const {data}=ctx.getImageData(0,0,canvas.width,canvas.height);
      let transparent=false;const left:string[]=[],right:string[]=[];
      for(let y=0;y<canvas.height;y+=3){let l=canvas.width,r=-1;for(let x=0;x<canvas.width;x++){
        if(data[(y*canvas.width+x)*4+3]>32){l=Math.min(l,x);r=x;}else transparent=true;
      }if(r>=l){left.push(`${l/canvas.width*100}% ${y/canvas.height*100}%`);right.push(`${(r+1)/canvas.width*100}% ${y/canvas.height*100}%`);}}
      if(!transparent||!left.length)throw Error(`У спрайта ${src} нет прозрачного фона.`);
      return [emotion,{src,clip:`polygon(${[...left,...right.reverse()].join(',')})`}] as const;
    })).then(entries=>new Map(entries));
    this.cache.set(skin,loading);return loading;
  }
  wearSkin(skin:MotyaSkinId){
    if(!this.canWear(skin))return false;
    let saved=false;try{saved=saveMotyaSkin(localStorage,skin,this.canWear('royal'),skinIds.filter(this.canWear));}catch{}
    if(saved)this.activeSkin=skin;
    this.render(this.controller.state);return saved;
  }
  isSkinUnlocked(skin:MotyaSkinId){return this.canWear(skin);}
  previewSkin(skin:MotyaSkinId,emotion:MotyaEmotion,host:HTMLElement){
    this.preview={skin,emotion};this.root.classList.add('motya--wardrobe');host.append(this.root);this.render(this.controller.state);
  }
  endPreview(){if(!this.preview)return;this.preview=null;this.root.classList.remove('motya--wardrobe');this.mount(null);this.render(this.controller.state);}
  notify(event:PhoebeEvent){
    if(this.disposed)return false;const accepted=this.controller.notify(event);
    if(accepted&&(event.type==='level-win'||event.type==='game-win')){this.mount(document.getElementById(event.type==='game-win'?'campaign-complete':'victory') as HTMLDialogElement);this.render(this.controller.state);}
    return accepted;
  }
  setScreen(screen:string){
    if(this.disposed)return;this.screen=screen;if(screen==='editor')this.controller.reset();
    if(this.root.parentElement instanceof HTMLDialogElement&&!this.root.parentElement.open)this.mount(null);
    this.render(this.controller.state);
  }
  private mount(dialog:HTMLDialogElement|null){
    this.root.classList.toggle('motya--dialog',!!dialog);
    if(dialog)dialog.insertBefore(this.root,dialog.querySelector(':scope > button'));else document.body.append(this.root);
    this.scheduleLayout();
  }
  private render(state:PhoebeState){
    if(this.disposed)return;const version=++this.renderVersion;
    const preview=this.preview,skin=preview?.skin??this.activeSkin,emotion=preview?.emotion??state.emotion;
    const animation=preview?'idle':state.animation;
    this.root.hidden=!preview&&(!state.enabled||this.screen==='editor'||this.screen==='settings'||this.screen==='wardrobe');
    this.root.dataset.skin=skin;this.root.dataset.emotion=emotion;
    this.button.tabIndex=preview?-1:0;this.button.title=preview?'Предпросмотр Моти':'Поговорить с Мотей';this.button.setAttribute('aria-label',this.button.title);
    if(this.root.hidden){this.spriteSwitcher.cancel();this.bubble.hidden=true;return;}
    const src=skinSprite(skin,emotion);
    if(this.image.getAttribute('src')!==src)this.spriteSwitcher.cancel();
    this.root.dataset.assets='loading';
    this.image.alt=emotion==='SAD'?'Грустная Мотя':emotion==='SHOCK'?'Удивлённая Мотя':'Мотя';
    this.bubble.textContent=preview?'':state.message;this.bubble.hidden=!!preview||!state.message;
    const restart=this.root.dataset.animation!==animation;this.root.dataset.animation=animation;
    void this.loadSprites(skin).then(sprites=>{
      if(this.disposed||version!==this.renderVersion)return false;
      return this.spriteSwitcher.show(sprites.get(emotion)!);
    }).then(shown=>{
      if(!shown||this.disposed||version!==this.renderVersion)return;
      this.root.dataset.assets='ready';document.getElementById('motya-asset-warning')!.hidden=true;
      if(restart){this.button.style.animation='none';void this.button.offsetWidth;this.button.style.removeProperty('animation');}
      this.scheduleLayout();
    }).catch(error=>{
      if(this.disposed||version!==this.renderVersion)return;this.spriteSwitcher.cancel();this.root.dataset.assets='error';
      const warning=document.getElementById('motya-asset-warning')!;warning.hidden=false;warning.textContent='Не удалось загрузить образ Моти. Выберите другой костюм в гардеробе.';console.warn('Мотя:',error);
    });
    this.scheduleLayout();
  }
  private scheduleLayout(){
    if(this.disposed||this.root.hidden||this.layoutFrame)return;
    this.layoutFrame=requestAnimationFrame(()=>{this.layoutFrame=0;this.layout();});
  }
  private layout(){
    if(this.root.hidden||this.preview||this.root.classList.contains('motya--dialog'))return;
    let bottom=this.screen==='home'?38:18;const mobile=innerWidth<=650,size=mobile?112:175,right=mobile?12:20;
    const obstacles=this.screen==='game'?[this.footer,document.getElementById('toast')!]:this.screen==='home'?[document.querySelector('.home-actions')!,document.getElementById('progress-summary')!]:[];
    for(const obstacle of obstacles){const rect=obstacle.getBoundingClientRect();
      if(rect.width&&innerWidth-right-size<rect.right&&innerWidth-right>rect.left&&innerHeight-bottom>rect.top&&innerHeight-bottom-size<rect.bottom)bottom=Math.max(bottom,innerHeight-rect.top+12);
    }
    this.root.style.setProperty('--motya-bottom',`${bottom}px`);this.root.style.setProperty('--motya-size',`${size}px`);
  }
  dispose(){
    if(this.disposed)return;this.disposed=true;this.renderVersion++;this.controller.dispose();this.spriteSwitcher.dispose();this.listeners.abort();this.observer.disconnect();
    if(this.layoutFrame)cancelAnimationFrame(this.layoutFrame);this.setting.closest('.motya-setting')?.remove();document.getElementById('motya-asset-warning')?.remove();this.root.remove();
  }
}
