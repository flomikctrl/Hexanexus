import {execFileSync} from 'node:child_process';
import {existsSync,readdirSync,readFileSync,mkdirSync,writeFileSync,statSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve,join} from 'node:path';
const root=process.cwd(),apk=resolve(process.argv[2]||'release/Hexanexus-Android.apk');
const java=process.env.JAVA_HOME||join(root,'.tools','java',readdirSync('.tools/java').find(n=>n.startsWith('jdk-21')));
const sdk=process.env.ANDROID_HOME||join(root,'.tools','android-sdk'),tools=join(sdk,'build-tools','36.0.0');
const exe=name=>process.platform==='win32'?name+'.exe':name;
const env={...process.env,JAVA_HOME:java,DEBUG:''};
const run=(file,args,cwd=root)=>execFileSync(file,args,{cwd,env,encoding:'utf8',windowsHide:true});
if(!existsSync(apk)||statSync(apk).size<100000)throw Error('APK не найден или пуст.');
const files=run(join(java,'bin',exe('jar')),['tf',apk]).split(/\r?\n/).filter(Boolean);
const skins=['classic','sleepy','baker','winter','wizard','cosmic','royal','architect','flower','pirate','night','archdemon'];
const spriteFiles=skins.flatMap(id=>['idle','sad','shock'].map(emotion=>`assets/public/assets/motya/${id}/${emotion}.png`));
for(const file of ['AndroidManifest.xml','classes.dex','assets/public/index.html','assets/public/audio/silhouette-loop.wav','assets/capacitor.config.json',...spriteFiles])if(!files.includes(file))throw Error('Нет ресурса в APK: '+file);
const js=files.filter(n=>n.startsWith('assets/public/assets/')&&n.endsWith('.js'));if(js.length<2)throw Error('Не найдены игровые JS-бандлы.');
const inspect=join(root,'.tools','apk-inspection');mkdirSync(inspect,{recursive:true});run(join(java,'bin',exe('jar')),['xf',apk,'assets/capacitor.config.json','assets/public/audio/silhouette-loop.wav',...spriteFiles,...js],inspect);
const config=JSON.parse(readFileSync(join(inspect,'assets/capacitor.config.json'),'utf8'));if(config.appId!=='com.hexanexus.puzzle'||config.server?.url)throw Error('Некорректная production-конфигурация.');
const nativeSafeArea=config.plugins?.SystemBars?.insetsHandling==='native';
if(nativeSafeArea&&config.plugins.SystemBars.initialViewportFitValueHint!=='contain')throw Error('Native safe-area viewport hint is inconsistent');
const code=js.map(n=>readFileSync(join(inspect,n),'utf8')).join('\n');
if(!js.some(file=>file.includes('hint-worker'))||!code.includes('Все шаги решения показаны!')||code.includes('setHintVisible'))throw Error('Step hints or offline solver worker missing; legacy toggle must be absent');
const levelNames=[...readFileSync('src/levels.ts','utf8').matchAll(/make\('([^']+)'/g)].map(m=>m[1]);
if(!levelNames.length)throw Error('No campaign levels found');
for(const name of levelNames)if(!code.includes(name))throw Error('Missing bundled level: '+name);
const dialogue=[...new Set([...readFileSync('src/phoebe-lines.ts','utf8').matchAll(/'([^']+)'/g)].map(m=>m[1]))];
for(const line of dialogue)if(!code.includes(line))throw Error('Missing bundled mascot line: '+line);
if(files.some(file=>file.startsWith('assets/public/phoebe/')))throw Error('Legacy mascot sprites are still in the APK');
if(js.some(file=>file.includes('dev-editor'))||code.includes('<section id="editor"')||code.includes('Экспорт JSON')||code.includes('Фиби'))throw Error('Production contains editor or legacy mascot UI');
for(const file of spriteFiles){const bundled=createHash('sha256').update(readFileSync(join(inspect,file))).digest('hex');const original=createHash('sha256').update(readFileSync(file.replace('assets/public/','public/'))).digest('hex');if(bundled!==original)throw Error('Bundled sprite differs: '+file);}
if(code.includes('id="cell-drawer"')||code.includes('id="cells"')||code.includes('id="layer-axis"'))throw Error('Removed cell selection panel is still bundled');
if(!code.includes('hexanexus.motya.royal.v1')||!code.includes('Королева Мотя'))throw Error('Royal campaign reward missing from bundle');
const badging=run(join(tools,exe('aapt')),['dump','badging',apk]);if(!badging.includes("package: name='com.hexanexus.puzzle'"))throw Error('Неверный applicationId в AndroidManifest.');
const permissions=run(join(tools,exe('aapt')),['dump','permissions',apk]);if(permissions.includes('android.permission.INTERNET'))throw Error('Offline APK неожиданно запрашивает INTERNET.');
const resources=run(join(tools,exe('aapt')),['dump','--values','resources',apk]);
// Release optimization shortens APK paths. Resolve actual files from the resource table.
const resourcePaths=new Map();let resourceConfig='',resourceName='';
for(const line of resources.split(/\r?\n/)){
 const config=line.match(/^\s+config ([^:]+):/);if(config)resourceConfig=config[1];
 const resource=line.match(/^\s+resource \S+ [^\s:]+:([^:]+):/);if(resource)resourceName=resource[1];
 const value=line.match(/^\s+\(string8\) "(res\/[^"]+)"/);if(value)resourcePaths.set(resourceName+'@'+resourceConfig,value[1]);
}
const iconPairs=[];
for(const density of ['mdpi','hdpi','xhdpi','xxhdpi','xxxhdpi'])for(const name of ['ic_launcher.png','ic_launcher_round.png']){
 const packaged=resourcePaths.get('mipmap/'+name.replace('.png','')+'@'+density);
 if(!packaged)throw Error('Missing launcher icon: '+density+'/'+name);
 iconPairs.push([packaged,`android/app/src/main/res/mipmap-${density}/${name}`]);
}
for(const name of ['motya_launcher_foreground.png','motya_launcher_background.png']){
 const packaged=resourcePaths.get('drawable/'+name.replace('.png','')+'@nodpi');
 if(!packaged)throw Error('Missing adaptive layer: '+name);
 iconPairs.push([packaged,`android/app/src/main/res/drawable-nodpi/${name}`]);
}
for(const name of ['16','32','48','96','180','192','512'])iconPairs.push([`assets/public/icons/icon-${name}.png`,`public/icons/icon-${name}.png`]);
iconPairs.push(['assets/public/favicon.ico','public/favicon.ico']);
iconPairs.push(['assets/public/icons/favicon.ico','public/icons/favicon.ico']);
run(join(java,'bin',exe('jar')),['xf',apk,'assets/public/index.html',...iconPairs.map(([file])=>file)],inspect);
for(const [packaged,source]of iconPairs){if(!readFileSync(join(inspect,packaged)).equals(readFileSync(source)))throw Error('Bundled icon differs: '+packaged);}
const manifestTree=run(join(tools,exe('aapt')),['dump','xmltree',apk,'AndroidManifest.xml']);
const publicRelease=/Hexanexus-v[\d.]+\.apk$/.test(apk);
const version=JSON.parse(readFileSync('package.json','utf8')).version;
if(['1.3.0','1.4.0'].includes(version)){
 const coin='assets/public/icons/hexic.svg';if(!files.includes(coin))throw Error('Гексики: нет иконки шестиугольной монеты');
 run(join(java,'bin',exe('jar')),['xf',apk,coin],inspect);
 if(!readFileSync(join(inspect,coin)).equals(readFileSync('public/icons/hexic.svg')))throw Error('Иконка гексиков отличается от исходника');
 for(const text of ['hexanexus.economy.v1','Достижения','Легенда мастерской','Повелитель кубиков','гексиков','lobby-stage','currency-help','Мастерская Моти','Один подарок — один новый наряд!','gift-result','Коллекция собрана!','Новый наряд! Мотя в восторге!','getRandomValues'])if(!code.includes(text))throw Error('Economy/lobby/gifts asset/code missing: '+text);
 if(code.includes('Скоро в игре!')||code.includes('Будущие подарки Моти:'))throw Error('Old gift placeholder remains in APK');
 console.log('Verified гексики: offline wallet, achievements, hint fees and original hexagonal coin SVG.');
 const pluginsFile='assets/capacitor.plugins.json';if(!files.includes(pluginsFile))throw Error('Missing native Capacitor App registration');
 run(join(java,'bin',exe('jar')),['xf',apk,pluginsFile],inspect);
 const plugins=JSON.parse(readFileSync(join(inspect,pluginsFile),'utf8'));
 if(!plugins.some(p=>p.pkg==='@capacitor/app'&&p.classpath==='com.capacitorjs.plugins.app.AppPlugin')||!code.includes('Нажмите ещё раз для выхода'))throw Error('Native Back/exit integration missing');
}
if(version==='1.4.0'){
 for(const text of ['wardrobe-equip','outfit-selected','Костюмы и подарки','Бесконечный режим'])if(!code.includes(text))throw Error('Final 1.4 UI missing: '+text);
 if(!code.includes('Мотя-архитектор')||code.includes('Костюм появится после добавления его спрайтов'))throw Error('Architect outfit missing or still a placeholder');
 for(const text of ['profile-screen','Мой профиль','profile-avatar-grid','Повелитель граней','profile-second-campaign','campaign-screen','hexanexus.campaign2.progress.v1','Новая грань: покоритель'])if(!code.includes(text))throw Error('Profile/second campaign missing from APK: '+text);
 const names=[...readFileSync('src/levels-second.ts','utf8').matchAll(/design\(\d+,'([^']+)'/g)].map(m=>m[1]);if(names.length!==30||names.some(n=>!code.includes(n)))throw Error('Second campaign level missing from APK');
}
const versionCode=readFileSync('android/app/build.gradle','utf8').match(/versionCode (\d+)/)?.[1];
if(!badging.includes(`versionName='${version}'`)||!badging.includes(`versionCode='${versionCode}'`))throw Error('Wrong APK version');
if(!code.includes('hexanexus.arcade.session.v1')||!code.includes('hexanexus.arcade.records.v1')||!code.includes('Бесконечный режим'))throw Error('Endless mode missing from bundle');
if(publicRelease){
 if(badging.includes('application-debuggable')||/android:debuggable[^\n]+0xffffffff/.test(manifestTree))throw Error('Public release is debuggable');
 if(files.some(file=>/(?:^|\/)(?:node_modules|\.tools)\/|\.(?:keystore|jks|zip|map)$|(?:^|\/)\.env(?:\.|$)|\.test\.[jt]s$/.test(file)))throw Error('Development files or private data in release');
}
for(const [attribute,resource]of [['icon','ic_launcher'],['roundIcon','ic_launcher_round']]){
 const id=resources.match(new RegExp(`resource (0x[0-9a-f]+) [^\\s:]+:mipmap/${resource}:`))?.[1];
 if(!id||!new RegExp(`android:${attribute}\\([^\\n]+=@${id}\\b`).test(manifestTree))throw Error('Manifest does not use new '+attribute);
}
for(const name of ['ic_launcher','ic_launcher_round']){
 const path=resourcePaths.get('mipmap/'+name+'@anydpi-v26');
 if(!path)throw Error('Missing adaptive icon: '+name);
 const tree=run(join(tools,exe('aapt')),['dump','xmltree',apk,path]);
 for(const layer of ['motya_launcher_foreground','motya_launcher_background']){
  const id=resources.match(new RegExp(`resource (0x[0-9a-f]+) [^\\s:]+:drawable/${layer}:`))?.[1];
  if(!id||!tree.includes('@'+id))throw Error('Wrong adaptive layer: '+layer);
 }
}
if(!readFileSync(join(inspect,'assets/public/index.html'),'utf8').includes('href="/icons/favicon.ico"'))throw Error('Favicon not linked');
if(nativeSafeArea&&!readFileSync(join(inspect,'assets/public/index.html'),'utf8').includes('viewport-fit=contain'))throw Error('Safe-area native container requires viewport-fit=contain');
console.log('Verified Motya launcher: 10 legacy/round PNGs, 2 adaptive layers and XMLs, 9 web icon files; manifest references confirmed.');
mkdirSync('artifacts',{recursive:true});writeFileSync('artifacts/app-icons-verification.json',JSON.stringify({apk,legacyAndRoundIcons:10,adaptiveLayers:2,adaptiveXmls:2,webIconFiles:9,manifestReferencesVerified:true,packagedIconsMatchSources:true,packagedFiles:iconPairs.map(([file])=>file)},null,2));
const signature=run(join(java,'bin',exe('java')),['-jar',join(tools,'lib','apksigner.jar'),'verify','--verbose','--print-certs',apk]);if(!signature.includes('Verified using'))throw Error('Подпись не подтверждена.');
if(!signature.includes('7fd9293ff232d5623937b05a6da52032092900a8de241db1c9fcdfca12218c68'))throw Error('APK certificate differs from existing installations');
const musicHash=createHash('sha256').update(readFileSync(join(inspect,'assets/public/audio/silhouette-loop.wav'))).digest('hex');
if(musicHash!==createHash('sha256').update(readFileSync('public/audio/silhouette-loop.wav')).digest('hex'))throw Error('Bundled music differs from the source asset');
const report={musicSha256:musicHash,apk,size:statSync(apk).size,sha256:createHash('sha256').update(readFileSync(apk)).digest('hex'),appId:config.appId,levels:levelNames.length+(version==='1.4.0'?30:0),campaignLevels:version==='1.4.0'?[30,30]:[levelNames.length],mascotLines:dialogue.length,motyaSkins:skins.length,packagedMotyaSprites:spriteFiles.length,editorExcluded:true,packagedMusic:true,webFiles:files.filter(n=>n.startsWith('assets/public/')).length,networkPermission:false,signatureVerified:true,signature};mkdirSync('artifacts',{recursive:true});writeFileSync('artifacts/apk-verification.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
