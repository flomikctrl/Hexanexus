import * as T from 'three';
import {blockAppearance} from './presentation';
import type {CubeSkin,FieldBackground} from './customization';

// Created on selection, never in the render loop. All textures are generated
// locally: no downloads, image decoding, or additional Android permissions.
export class SceneAppearance {
 private wood?:T.DataTexture;
 private reflection?:T.DataTexture;
 private backgrounds=new Map<FieldBackground,T.DataTexture>();
 cube:CubeSkin='classic';background:FieldBackground='classic';
 material(fixed:boolean){
  const base=fixed?blockAppearance.fixed:blockAppearance.player;
  const standard={...base,metalness:.42,roughness:.4,opacity:1,map:null as T.Texture|null};
  if(this.cube==='wood'){let map:T.Texture;try{map=this.woodTexture();}catch{return standard;}return {...standard,body:fixed?0x9b6138:0xbd8252,emissive:0x1d1007,emission:.025,edge:fixed?0x58321c:0xe0ac73,corner:fixed?0x56341f:0x85552f,metalness:0,roughness:.88,map};}
  if(this.cube==='crystal')return {...standard,body:fixed?0x377a9a:0x9cdbeb,emissive:0x18495c,emission:.18,edge:fixed?0xc5b17c:0xe0f7ff,corner:fixed?0xb59a59:0x345b6e,metalness:.18,roughness:.23,opacity:.86};
  if(this.cube==='gold')return {...standard,body:fixed?0xbd8326:0xd49a38,emissive:0x271404,emission:.025,edge:fixed?0xe5ac45:0xffd484,corner:fixed?0x633b10:0xa66b20,metalness:1,roughness:.28};
  return standard;
 }
 private woodTexture(){
  if(this.wood)return this.wood;
  const n=128,pixels=new Uint8Array(n*n*8);
  for(let y=0;y<n;y++)for(let x=0;x<n*2;x++){const i=(y*n*2+x)*4,u=x%n,v=y,warp=Math.sin(v*.055)*4+Math.sin(v*.13)*1.2,r=Math.hypot((u-44)*.85,(v-68)*1.04),phase=x<n?u*.32+warp:r*.38+Math.sin(u*.08)*.4,grain=.72+.13*Math.sin(phase)+.075*Math.sin(phase*2.8)+.035*Math.sin(u*2.7+v*.4);pixels[i]=Math.round(255*grain);pixels[i+1]=Math.round(240*grain);pixels[i+2]=Math.round(218*grain);pixels[i+3]=255;}
  this.wood=new T.DataTexture(pixels,n*2,n);this.wood.colorSpace=T.SRGBColorSpace;this.wood.magFilter=T.LinearFilter;this.wood.minFilter=T.LinearFilter;this.wood.needsUpdate=true;return this.wood;
 }
 configure(material:T.MeshStandardMaterial){
  material.envMap=this.cube==='gold'?this.reflections():null;material.envMapIntensity=.85;
  material.customProgramCacheKey=()=>this.cube==='wood'?'wood-object-grain-v1':'standard';
  const wood=this.cube==='wood';material.onBeforeCompile=shader=>{if(!wood)return;shader.vertexShader='varying vec3 woodPosition;varying vec3 woodNormal;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nwoodPosition=position;woodNormal=normal;');shader.fragmentShader='varying vec3 woodPosition;varying vec3 woodNormal;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#ifdef USE_MAP
 vec3 n=abs(normalize(woodNormal));vec2 uv=n.y>.65?woodPosition.xz:n.x>.65?woodPosition.zy:woodPosition.xy;uv=clamp(uv+vec2(.5),.01,.99);uv.x=uv.x*.5+(n.y>.65?.5:0.);diffuseColor*=texture2D(map,uv);diffuseColor.rgb*=.94+.06*abs(woodNormal.z);
 #endif`);};material.needsUpdate=true;
 }
 private reflections(){if(this.reflection)return this.reflection;const w=128,h=64,data=new Float32Array(w*h*4);for(let y=0;y<h;y++)for(let x=0;x<w;x++){const u=x/w,v=y/h,i=(y*w+x)*4,soft=Math.exp(-((u-.24)**2*600+(v-.3)**2*35))*2.2+Math.exp(-((u-.76)**2*220+(v-.42)**2*70))*1.1,base=.1+.2*Math.max(0,1-v*1.3);data[i]=base+soft;data[i+1]=base+soft*.91;data[i+2]=base+soft*.76;data[i+3]=1;}this.reflection=new T.DataTexture(data,w,h,T.RGBAFormat,T.FloatType);this.reflection.mapping=T.EquirectangularReflectionMapping;this.reflection.needsUpdate=true;return this.reflection;}
 applyLobby(group:T.Group){
  const body=group.children[0] as T.InstancedMesh<T.BufferGeometry,T.MeshStandardMaterial>,edges=group.children[1] as T.LineSegments<T.BufferGeometry,T.LineBasicMaterial>;if(!body||!edges)return;
  const a=this.material(false),classic=this.cube==='classic',m=body.material;
  m.color.setHex(classic?0x3c9b92:a.body);m.emissive.setHex(classic?0x164b42:a.emissive);m.emissiveIntensity=classic?.35:a.emission;m.metalness=classic?.6:a.metalness;m.roughness=classic?.3:a.roughness;m.map=a.map;m.opacity=a.opacity;m.transparent=a.opacity<1;m.needsUpdate=true;
  edges.material.color.setHex(classic?0x70a899:a.edge);
  this.configure(m);
 }
 backdrop(_menu:boolean):T.Color|T.Texture {
  if(this.background==='classic')return new T.Color('#152e32');
  const cached=this.backgrounds.get(this.background);if(cached)return cached;
  try{
   const n=512,pixels=new Uint8Array(n*n*4),type=this.background;
   for(let y=0;y<n;y++)for(let x=0;x<n;x++){
    const i=(y*n+x)*4,u=x/n,v=y/n,glow=Math.exp(-((u-.5)**2*9+(v-.4)**2*6));
    let r:number,g:number,b:number;
    if(type==='forest'){const trees=Math.max(0,Math.sin(x*.055)+Math.sin(x*.023+2))*.016*(v>.15?1:0);r=13+glow*9-trees*70;g=34+glow*20-trees*140;b=29+glow*9-trees*110;}
    else if(type==='stars'){const mist=Math.exp(-((u-.7+Math.sin(v*6)*.1)**2*16+(v-.35)**2*5));r=7+mist*9;g=13+mist*10;b=31+mist*25;const sx=Math.floor(x/3),sy=Math.floor(y/3),star=((sx*73856093)^(sy*19349663))>>>0;if(star%167===0){const d=(x%3-1)**2+(y%3-1)**2,light=d===0?135:23;r+=light;g+=light;b+=light;}}
    else{const ribbon=Math.exp(-((u-.45-Math.sin(v*7)*.18)**2*32))*Math.exp(-((v-.4)**2)*3),cloud=Math.sin(u*13+v*7)*Math.sin(v*17-u*4)*.5+.5;r=22+ribbon*29+cloud*6;g=11+ribbon*15;b=43+ribbon*47+cloud*12;const mote=((Math.floor(x/4)*83492791)^(Math.floor(y/4)*19349663))>>>0;if(mote%701===0&&x%4===1&&y%4===1){r+=60;g+=50;b+=80;}}
    pixels[i]=r;pixels[i+1]=g;pixels[i+2]=b;pixels[i+3]=255;
   }
   const texture=new T.DataTexture(pixels,n,n);texture.colorSpace=T.SRGBColorSpace;texture.magFilter=T.LinearFilter;texture.minFilter=T.LinearFilter;texture.needsUpdate=true;this.backgrounds.set(type,texture);return texture;
  }catch{return new T.Color('#152e32');}
 }
 fogColor(_menu:boolean){return this.background==='classic'?'#152e32':this.background==='forest'?'#102a22':this.background==='stars'?'#090e26':'#221036';}
 dispose(){this.wood?.dispose();this.reflection?.dispose();this.backgrounds.forEach(t=>t.dispose());this.backgrounds.clear();}
}
