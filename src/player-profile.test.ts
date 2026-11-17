import {describe,it,expect,vi} from 'vitest';
import {Economy,economyKey} from './economy';
import {levels} from './levels';
import {skinIds,skinStorageKey,motyaCollection} from './motya-skins';
import {campaignProfileStats,arcadeProfileStats,normalizePlayerProfile,defaultPlayerProfile,playerNameError,editedPlayerProfile} from './player-profile';
import {BackNavigation} from './back-navigation';
import {readArcadeRecords,arcadeRecordsKey} from './arcade';
const completed=(n:number)=>levels.slice(0,n).map(l=>l.name);
function fixture(n=30){
 const data=new Map<string,string>(),storage={getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>{data.set(k,v);}};
 const first=new Economy(storage,{completed:completed(n),bestSolved:61}),d=first.snapshot;
 delete d.profile;d.balance=125;d.gifts={version:1,owned:['baker','winter','wizard','sleepy'],sequence:4,pending:null};data.set(economyKey,JSON.stringify(d));data.set(skinStorageKey,'wizard');
 data.set('hexanexus.progress.v2',JSON.stringify({completed:completed(n),current:29,tutorialSeen:true}));data.set('hexanexus.music','original music');data.set('hexanexus.motya.royal.v1','original entitlement');data.set(arcadeRecordsKey,JSON.stringify({version:1,bestRound:62,bestScore:9390,bestStreak:37,games:2,counted:[]}));
 const load=()=>new Economy(storage,{completed:completed(n),bestSolved:61},n===30);
 return {data,storage,load,before:structuredClone(d)};
}
describe('Профиль 1.4: миграция без изменений данных 1.3',()=>{
 it('автоматически создаёт профиль с именем Игрок внутри существующего кошелька',()=>{
  const f=fixture(),e=f.load();expect(e.ready).toBe(true);expect(e.profile).toMatchObject({version:1,name:'Игрок',avatar:{skin:'classic',emotion:'IDLE'},title:'novice',frame:'plain'});
  const after=e.snapshot;delete after.profile;expect(after).toEqual(f.before);expect(f.data.size).toBe(6);
 });
 it('повторные старты не начисляют бонусы и достижения, не сбрасывают коллекцию',()=>{
  const f=fixture(),e=f.load(),original=JSON.stringify(e.snapshot),other=new Map(f.data);for(let i=0;i<5;i++){const next=f.load();expect(next.balance).toBe(125);expect(next.initialCredit).toBe(0);expect(JSON.stringify(next.snapshot)).toBe(original);}
  for(const [k,v]of other)expect(f.data.get(k)).toBe(v);expect(e.gifts.owned).toHaveLength(4);
 });
 it('сохраняет кириллицу, латиницу и цифры; обрезает крайние пробелы',()=>{
  const f=fixture(),e=f.load();expect(e.editProfile({name:'  Мотя Flom 17  '})).toBe(true);expect(f.load().profile.name).toBe('Мотя Flom 17');
 });
 it.each(['','   ','\n\t','а'.repeat(21),'<script>','Мотя\u0000'])('не сохраняет неверное имя %j',name=>{
  const f=fixture(),e=f.load(),before=f.data.get(economyKey);expect(e.editProfile({name})).toBe(false);expect(f.data.get(economyKey)).toBe(before);expect(e.profile.name).toBe('Игрок');
 });
 it.each(['А','a'.repeat(20),'12345','Ёжик-007','Игрок_2'])('принимает граничное корректное имя %s',name=>{expect(playerNameError(name)).toBe('');});
 it('доступная аватарка и эмоция сохраняются независимо от надетого костюма',()=>{
  const f=fixture(),e=f.load();expect(e.editProfile({avatar:{skin:'royal',emotion:'SHOCK'}})).toBe(true);expect(f.data.get(skinStorageKey)).toBe('wizard');
  expect(f.load().profile.avatar).toEqual({skin:'royal',emotion:'SHOCK'});expect(f.data.get(skinStorageKey)).toBe('wizard');
 });
 it.each(['IDLE','SAD','SHOCK'] as const)('сохраняет эмоцию %s',emotion=>{const f=fixture(),e=f.load();expect(e.editProfile({avatar:{skin:'baker',emotion}})).toBe(true);expect(f.load().profile.avatar.emotion).toBe(emotion);});
 it('показывает семь костюмов, доступность подарочных и Королевы независима',()=>{
  const f=fixture(),e=f.load();expect(skinIds).toHaveLength(12);expect(motyaCollection('wizard',true,e.gifts.owned).ownedSkinIds).toHaveLength(6);
  expect(e.editProfile({avatar:{skin:'cosmic',emotion:'IDLE'}})).toBe(false);expect(e.editProfile({avatar:{skin:'classic',emotion:'IDLE'}})).toBe(true);
  expect(fixture(0).load().editProfile({avatar:{skin:'royal',emotion:'IDLE'}})).toBe(false);
 });
 it('больше недоступная аватарка заменяется classic, остальные поля и деньги прежние',()=>{
  const f=fixture(),e=f.load();e.editProfile({name:'Flom',avatar:{skin:'wizard',emotion:'SAD'},title:'master'});
  const d=e.snapshot;d.gifts!.owned=['baker','winter','sleepy'];d.gifts!.sequence=3;f.data.set(economyKey,JSON.stringify(d));
  const next=f.load();expect(next.profile).toMatchObject({name:'Flom',avatar:{skin:'classic',emotion:'SAD'},title:'master'});expect(next.balance).toBe(125);
 });
 it.each([[0,['novice']],[9,['novice']],[10,['novice','explorer']],[29,['novice','explorer']],[30,['novice','explorer','master']]])('звания учитывают %i настоящих завершений',(n,titles)=>{
  expect(fixture(Number(n)).load().profile.unlockedTitles).toEqual(titles);
 });
 it('звания открываются при живом прохождении и сохраняются без платы',()=>{
  const f=fixture(0),e=f.load();e.syncCampaign(completed(10));const balance=e.balance;expect(e.profile.unlockedTitles).toContain('explorer');expect(e.editProfile({title:'explorer'})).toBe(true);expect(e.balance).toBe(balance);expect(f.load().profile.title).toBe('explorer');
 });
 it('закрытое будущее звание и золотая рамка недоступны даже при подмене profile',()=>{
  const f=fixture(),e=f.load();expect(e.editProfile({title:'facets'})).toBe(false);expect(e.editProfile({frame:'gold'})).toBe(false);
  expect(normalizePlayerProfile({...e.profile,title:'facets',frame:'gold',unlockedTitles:['novice','facets']},completed(30),()=>true)).toMatchObject({title:'novice',frame:'plain',unlockedTitles:['novice','explorer','master']});
 });
 it('обычная рамка сохраняется отдельно от аватарки, звания и костюма',()=>{const f=fixture(),e=f.load();e.editProfile({avatar:{skin:'baker',emotion:'SAD'},title:'explorer'});expect(e.editProfile({frame:'plain'})).toBe(true);expect(f.load().profile).toMatchObject({avatar:{skin:'baker',emotion:'SAD'},title:'explorer',frame:'plain'});expect(f.data.get(skinStorageKey)).toBe('wizard');});
 it('не считает открытый 30-й уровень, повторы и чужие ID прохождением',()=>{
  expect(campaignProfileStats([...completed(10),...completed(10),'unknown'])).toMatchObject({completed:10,total:30,percent:33});expect(campaignProfileStats([]).percent).toBe(0);expect(campaignProfileStats(completed(30)).percent).toBe(100);
 });
 it('бесконечные рекорды: 62-й раунд означает 61 решение, не 62',()=>{
  const f=fixture();expect(arcadeProfileStats(readArcadeRecords(f.storage))).toEqual({solved:61,score:9390,streak:37});expect(arcadeProfileStats(readArcadeRecords())).toEqual({solved:0,score:0,streak:0});
 });
 it('редактирование не меняет баланс, достижения, коллекцию и другие ключи',()=>{
  const f=fixture(),e=f.load(),before=e.snapshot,keys=new Map(f.data);expect(e.editProfile({name:'Новый',avatar:{skin:'baker',emotion:'SHOCK'},title:'explorer'})).toBe(true);
  const after=e.snapshot;delete before.profile;delete after.profile;expect(after).toEqual(before);for(const [k,v]of keys)if(k!==economyKey)expect(f.data.get(k)).toBe(v);expect(e.snapshot.achievements).toHaveLength(6);
 });
 it('отказ записи не применяет настройки в памяти и не меняет сохранение',()=>{
  const f=fixture(),e=f.load(),before=f.data.get(economyKey);f.storage.setItem=()=>{throw Error('disk full');};expect(e.editProfile({name:'New'})).toBe(false);expect(e.profile.name).toBe('Игрок');expect(f.data.get(economyKey)).toBe(before);
 });
 it('повреждённый профиль и отказ миграционной записи не ломают чтение UI',()=>{
  const f=fixture(),raw={...f.before,profile:{version:1,avatar:null}};f.data.set(economyKey,JSON.stringify(raw));f.storage.setItem=()=>{throw Error('quota');};const e=f.load();expect(e.ready).toBe(false);expect(e.profile.avatar).toEqual({skin:'classic',emotion:'IDLE'});expect(e.editProfile({name:'New'})).toBe(false);expect(JSON.parse(f.data.get(economyKey)!)).toEqual(raw);
 });
 it('повреждённый профиль восстанавливает только профиль, не весь кошелёк',()=>{
  const f=fixture(),d={...f.before,profile:{version:1,name:'',avatar:{skin:'unknown',emotion:'BAD'},title:'facets',frame:'gold'}};f.data.set(economyKey,JSON.stringify(d));const e=f.load();expect(e.ready).toBe(true);expect(e.profile.name).toBe('Игрок');expect(e.balance).toBe(125);expect(e.gifts.owned).toHaveLength(4);
 });
 it('Back закрывает редактор первым, затем возвращает из профиля; выход не вызывается',()=>{
  let editor=true;const home=vi.fn(),exit=vi.fn(),nav=new BackNavigation({closeModal:()=>{if(!editor)return false;editor=false;return true;},closeMenu:()=>false,screen:()=> 'profile',home,pause:vi.fn(),hintExit:vi.fn(),exit});
  nav.handle();expect(home).not.toHaveBeenCalled();nav.handle();expect(home).toHaveBeenCalledOnce();expect(exit).not.toHaveBeenCalled();
 });
 it('не принимает фиктивные эмоции и сохраняет обычный стартовый вид',()=>{expect(editedPlayerProfile(defaultPlayerProfile(),{avatar:{skin:'classic',emotion:'BAD' as never}},()=>true)).toBeNull();});
});
