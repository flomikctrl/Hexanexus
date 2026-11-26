import * as T from 'three';
import {blockAppearance} from './presentation';
import type {CubeSkin,FieldBackground} from './customization';

// Created on selection, never in the render loop. All textures are generated
// locally: no downloads, image decoding, or additional Android permissions.
export class SceneAppearance {
 private wood?:T.DataTexture;
 private backgrounds=new Map<FieldBackground,T.DataTexture>();
 cube:CubeSkin='classic';background:FieldBackground='classic';
 material(fixed:boolean){
  const base=fixed?blockAppearance.fixed:blockAppearance.player;
  const standard={...base,metalness:.42,roughness:.4,opacity:1,map:null as T.Texture|null};
  if(this.cube==='wood'){let map:T.Texture;try{map=this.woodTexture();}catch{return standard;}return {...standard,body:fixed?0x795238:0xd0a16a,emissive:0x25190d,emission:.12,edge:fixed?0xd7b17b:0xffe3b1,corner:fixed?0x755333:0x394239,metalness:.05,roughness:.83,map};}
  if(this.cube==='crystal')return {...standard,body:fixed?0x377a9a:0x9cdbeb,emissive:0x18495c,emission:.18,edge:fixed?0xc5b17c:0xe0f7ff,corner:fixed?0xb59a59:0x345b6e,metalness:.18,roughness:.23,opacity:.86};
  if(this.cube==='gold')return {...standard,body:fixed?0x9d742b:0xe1b95f,emissive:0x594017,emission:.16,edge:fixed?0xf2d28f:0xffefd1,corner:fixed?0x6d542e:0x34514b,metalness:.65,roughness:.4};
  return standard;
 }
 private woodTexture(){
  if(this.wood)return this.wood;
  const n=128,pixels=new Uint8Array(n*n*4);
  for(let y=0;y<n;y++)for(let x=0;x<n;x++){const i=(y*n+x)*4,grain=.91+.055*Math.sin(x*.48+Math.sin(y*.09)*1.7)+.025*Math.sin(x*1.9+y*.04);pixels[i]=pixels[i+1]=pixels[i+2]=Math.round(grain*255);pixels[i+3]=255;}
  this.wood=new T.DataTexture(pixels,n,n);this.wood.colorSpace=T.SRGBColorSpace;this.wood.magFilter=T.LinearFilter;this.wood.minFilter=T.LinearFilter;this.wood.needsUpdate=true;return this.wood;
 }
 applyLobby(group:T.Group){
  const body=group.children[0] as T.InstancedMesh<T.BufferGeometry,T.MeshStandardMaterial>,edges=group.children[1] as T.LineSegments<T.BufferGeometry,T.LineBasicMaterial>;if(!body||!edges)return;
  const a=this.material(false),classic=this.cube==='classic',m=body.material;
  m.color.setHex(classic?0x3c9b92:a.body);m.emissive.setHex(classic?0x164b42:a.emissive);m.emissiveIntensity=classic?.35:a.emission;m.metalness=classic?.6:a.metalness;m.roughness=classic?.3:a.roughness;m.map=a.map;m.opacity=a.opacity;m.transparent=a.opacity<1;m.needsUpdate=true;
  edges.material.color.setHex(classic?0x70a899:a.edge);
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
    else if(type==='stars'){r=13+glow*12;g=20+glow*14;b=39+glow*22;const star=((x*73856093)^(y*19349663))>>>0;if(star%6701===0&&v<.9){r+=65;g+=66;b+=56;}}
    else{r=21+glow*13;g=22+glow*20;b=39+glow*23;}
    pixels[i]=r;pixels[i+1]=g;pixels[i+2]=b;pixels[i+3]=255;
   }
   const texture=new T.DataTexture(pixels,n,n);texture.colorSpace=T.SRGBColorSpace;texture.magFilter=T.LinearFilter;texture.minFilter=T.LinearFilter;texture.needsUpdate=true;this.backgrounds.set(type,texture);return texture;
  }catch{return new T.Color('#152e32');}
 }
 fogColor(_menu:boolean){return this.background==='classic'?'#152e32':this.background==='forest'?'#102a22':this.background==='stars'?'#10182d':'#1b1c30';}
 dispose(){this.wood?.dispose();this.backgrounds.forEach(t=>t.dispose());this.backgrounds.clear();}
}
