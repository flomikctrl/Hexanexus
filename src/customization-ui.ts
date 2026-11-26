import {Customization,cubeSkins,fieldBackgrounds,type AppearanceSettings} from './customization';
import './customization.css';
export class CustomizationUI {
 constructor(host:HTMLElement,private model:Customization,private apply:(settings:AppearanceSettings)=>void){
  host.classList.add('appearance-panel');host.innerHTML='<p class="appearance-free">Все оформления доступны бесплатно</p><h3>Кубики</h3><div class="appearance-options" data-options="cube"></div><h3>Фоны</h3><div class="appearance-options" data-options="background"></div><p class="appearance-status" role="status"></p>';
  for(const kind of ['cube','background'] as const)for(const option of kind==='cube'?cubeSkins:fieldBackgrounds){
   const button=document.createElement('button');button.type='button';button.dataset[kind]=option.id;button.className='appearance-card';button.innerHTML=`<span class="appearance-preview ${kind}-${option.id}" aria-hidden="true"></span><span>${option.name}</span><small></small>`;
   button.onclick=()=>{const saved=this.model.select(kind,option.id);host.querySelector('.appearance-status')!.textContent=saved?'Оформление применено':'Не удалось сохранить оформление. Попробуйте ещё раз.';if(saved){this.apply(this.model.settings);this.render(host);}};host.querySelector(`[data-options="${kind}"]`)!.append(button);
  }
  this.render(host);
 }
 private render(host:HTMLElement){for(const kind of ['cube','background'] as const)host.querySelectorAll<HTMLButtonElement>(`[data-${kind}]`).forEach(b=>{const selected=b.dataset[kind]===this.model.settings[kind];b.setAttribute('aria-pressed',String(selected));b.querySelector('small')!.textContent=selected?'✓ Выбрано':'Выбрать';});}
}
