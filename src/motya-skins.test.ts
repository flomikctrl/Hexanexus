import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {skinIds,motyaSkins,skinStorageKey,skinById,readMotyaSkin,saveMotyaSkin,motyaCollection,skinSprite} from './motya-skins';
import {PhoebeController} from './phoebe-state';
import {PhoebeSpriteSwitcher} from './phoebe-sprite';

describe('Мотя: оригинальные образы и безопасное сохранение',()=>{
  it('содержит стартовый, девять подарочных и два эксклюзивных образа',()=>{
    expect(motyaSkins).toHaveLength(12);expect(new Set(motyaSkins.map(s=>s.id)).size).toBe(12);
    expect(motyaCollection('wizard').ownedSkinIds).toEqual(['classic']);
    expect(motyaSkins.filter(s=>s.initiallyUnlocked)).toHaveLength(1);
    expect(motyaSkins.filter(s=>s.initiallyUnlocked).every(s=>s.acquisition==='included')).toBe(true);
    expect(motyaSkins.filter(s=>s.rarity==='legendary').map(s=>s.id)).toEqual(['sleepy','wizard','night','archdemon']);
  });
  it('возвращается к classic при первом запуске, неизвестном ID и отказе хранилища',()=>{
    for(const saved of [null,'','missing','../wizard','{"id":"wizard"}'])expect(readMotyaSkin({getItem:()=>saved})).toBe('classic');
    expect(readMotyaSkin({getItem:()=>{throw Error('denied');}})).toBe('classic');expect(skinById('unknown').id).toBe('classic');
  });
  it('пишет только отдельный ключ, сохраняя прогресс, музыку и старую настройку помощницы',()=>{
    const data=new Map([['hexanexus.progress.v2','old-progress'],['hexanexus.music','old-music'],['hexanexus.phoebe.enabled','false']]);
    const storage={getItem:(key:string)=>data.get(key)??null,setItem:(key:string,value:string)=>data.set(key,value)};
    for(const id of skinIds.filter(id=>id!=='royal')){expect(saveMotyaSkin(storage,id,false,skinIds)).toBe(true);expect(readMotyaSkin(storage,false,skinIds)).toBe(id);}
    expect(data.size).toBe(4);expect(data.get(skinStorageKey)).toBe('archdemon');
    expect(data.get('hexanexus.progress.v2')).toBe('old-progress');expect(data.get('hexanexus.music')).toBe('old-music');expect(data.get('hexanexus.phoebe.enabled')).toBe('false');
    expect(saveMotyaSkin({setItem:()=>{throw Error('denied');}},'winter')).toBe(false);
  });
  it.each(skinIds)('%s содержит три разных прозрачных PNG с единым холстом',id=>{
    const hashes=new Set<string>();
    for(const emotion of ['IDLE','SAD','SHOCK'] as const){
      const png=readFileSync(new URL('../public'+skinSprite(id,emotion),import.meta.url));
      expect(png.subarray(0,8)).toEqual(Buffer.from([137,80,78,71,13,10,26,10]));
      expect(png.readUInt32BE(16)).toBe(id==='royal'?1254:id==='architect'?724:id==='night'?340:1024);expect(png.readUInt32BE(20)).toBe(id==='royal'?1254:id==='architect'?724:id==='night'?340:1024);expect(png[25]).toBe(6);
      hashes.add(createHash('sha256').update(png).digest('hex'));
    }
    expect(hashes.size).toBe(3);
  });
  it.each(skinIds)('%s: IDLE → SHOCK/SAD → IDLE сохраняет один элемент',async id=>{
    const image={src:'',hidden:true,decode:()=>Promise.resolve()},committed:string[]=[];
    const switcher=new PhoebeSpriteSwitcher(image,sprite=>committed.push(sprite.src));
    for(const emotion of ['IDLE','SHOCK','IDLE','SAD','IDLE'] as const){
      const request=switcher.show({src:skinSprite(id,emotion),clip:'none'});expect(image.hidden).toBe(true);
      await request;expect(image.hidden).toBe(false);expect(image.src).toBe(skinSprite(id,emotion));
    }
    expect(committed).toHaveLength(5);
  });
  it('предпросмотр образа не требует изменения эмоции контроллера игры',async()=>{
    const game=new PhoebeController();game.notify({type:'forbidden',reason:'fixed'});const state={...game.state};
    const image={src:'',hidden:true,decode:()=>Promise.resolve()},preview=new PhoebeSpriteSwitcher(image,()=>{});
    for(const id of skinIds)await preview.show({src:skinSprite(id,'SAD'),clip:'none'});
    expect(game.state).toEqual(state);game.dispose();
  });
  it('запоздалое декодирование старого костюма не возвращает его поверх нового',async()=>{
    let finishClassic!:()=>void,finishWizard!:()=>void;
    const classic=new Promise<void>(resolve=>{finishClassic=resolve;}),wizard=new Promise<void>(resolve=>{finishWizard=resolve;});
    let loads=0;const image={src:'',hidden:true,decode:()=>++loads===1?classic:wizard};
    const shown:string[]=[],switcher=new PhoebeSpriteSwitcher(image,sprite=>shown.push(sprite.src));
    const old=switcher.show({src:skinSprite('classic','IDLE'),clip:'none'});
    const latest=switcher.show({src:skinSprite('wizard','SHOCK'),clip:'none'});
    finishClassic();expect(await old).toBe(false);expect(image.hidden).toBe(true);expect(shown).toEqual([]);
    finishWizard();expect(await latest).toBe(true);expect(shown).toEqual([skinSprite('wizard','SHOCK')]);expect(image.hidden).toBe(false);
  });
});
