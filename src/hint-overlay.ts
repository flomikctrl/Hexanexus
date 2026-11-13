import * as T from 'three';
import {key,type Vec} from './math';
import type {NumberedHint} from './hint-path';

export class HintOverlay {
 readonly group=new T.Group();
 private steps:NumberedHint[]=[];
 private signature='';
 private layoutStamp='';
 private labels:{root:T.Group;label:T.Object3D;anchor:T.Vector3;line:T.Line}[]=[];
 constructor(){this.group.name='campaign-hints';this.group.raycast=()=>{};}
 get count(){return this.steps.length;}
 set(steps:NumberedHint[],cells:Vec[]){
  const signature=JSON.stringify([steps,cells.map(key).sort()]);if(signature===this.signature)return;
  this.clear();this.signature=signature;this.steps=structuredClone(steps);
  const occupied=new Set(cells.map(key)),at=new Map<string,number>();
  for(const step of steps){
   const adding=step.tool==='place',color=adding?0xe3bd72:0xe89973,cellKey=key(step.cell),offset=at.get(cellKey)??0;at.set(cellKey,offset+1);
   const root=new T.Group();root.position.set(...step.cell);root.userData={hint:true,step:step.number,tool:step.tool,cell:[...step.cell]};root.raycast=()=>{};
   // Future additions over a currently occupied cell use an outline only: the
   // removal and later installation stay legible without covering the real cube.
   if(adding&&!occupied.has(cellKey)){
    const cube=new T.Mesh(new T.BoxGeometry(.88,.88,.88),new T.MeshBasicMaterial({color,transparent:true,opacity:.14,depthWrite:false}));cube.raycast=()=>{};root.add(cube);
   }
   const size=adding?1.015:.975;
   const geometry=new T.BoxGeometry(size,size,size),edges=new T.EdgesGeometry(geometry);geometry.dispose();
   const outline=new T.LineSegments(edges,new T.LineBasicMaterial({color,transparent:true,opacity:.75,depthWrite:false}));outline.raycast=()=>{};root.add(outline);
   const label=this.label(`${step.number} ${adding?'+':'−'}`,color),anchor=new T.Vector3(.24,.64+offset*.34,.24);label.position.copy(anchor);label.raycast=()=>{};
   const line=new T.Line(new T.BufferGeometry().setFromPoints([anchor,anchor]),new T.LineBasicMaterial({color,transparent:true,opacity:.55,depthTest:false,depthWrite:false}));line.visible=false;line.frustumCulled=false;line.renderOrder=7;line.raycast=()=>{};
   root.add(line,label);this.labels.push({root,label,anchor,line});this.group.add(root);
  }
 }
 private label(text:string,color:number):T.Object3D {
  if(typeof document==='undefined'){const node=new T.Group();node.scale.set(.64,.32,1);node.userData.label=text;return node;}
  const canvas=document.createElement('canvas');canvas.width=128;canvas.height=64;
  const ctx=canvas.getContext('2d')!;ctx.fillStyle='rgba(18,38,34,.9)';ctx.beginPath();ctx.roundRect(2,2,124,60,16);ctx.fill();ctx.strokeStyle='#'+color.toString(16).padStart(6,'0');ctx.lineWidth=3;ctx.stroke();
  ctx.fillStyle=ctx.strokeStyle;ctx.font='600 34px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,64,34);
  const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;
  const sprite=new T.Sprite(new T.SpriteMaterial({map:texture,transparent:true,depthTest:false,depthWrite:false}));sprite.scale.set(.64,.32,1);sprite.renderOrder=8;sprite.userData.label=text;return sprite;
 }
 layout(camera:T.PerspectiveCamera,width:number,height:number){
  if(!this.count||!this.group.visible||width<=0||height<=0)return;
  camera.updateMatrixWorld();this.group.updateWorldMatrix(true,true);
  const stamp=[width,height,...camera.matrixWorld.elements,...camera.projectionMatrix.elements,...this.group.quaternion.toArray()].join(',');if(stamp===this.layoutStamp)return;this.layoutStamp=stamp;
  const occupied:{x:number;y:number;w:number;h:number}[]=[];
  for(const {root,label,anchor,line}of this.labels){
   const world=root.localToWorld(anchor.clone()),point=world.clone().project(camera),distance=Math.abs(world.clone().applyMatrix4(camera.matrixWorldInverse).z);
   const scale=height/(2*Math.max(.01,distance)*Math.tan(T.MathUtils.degToRad(camera.fov/2))),w=label.scale.x*scale+6,h=label.scale.y*scale+6;
   const x=(point.x+1)*width/2,y=(1-point.y)*height/2;
   let chosen={x,y},found=false;
   // Move only number badges, never the cubes. A small connector keeps the
   // association clear when perspective projects several steps onto one spot.
   for(let ring=0;ring<=8&&!found;ring++)for(const [dx,dy]of ring?[[0,-ring*h],[ring*w,0],[-ring*w,0],[0,ring*h],[ring*w,-ring*h],[-ring*w,-ring*h]]:[[0,0]]){
    const next={x:x+dx,y:y+dy};if(next.x-w/2<4||next.x+w/2>width-4||next.y-h/2<4||next.y+h/2>height-4)continue;
    if(occupied.some(r=>Math.abs(next.x-r.x)<(w+r.w)/2&&Math.abs(next.y-r.y)<(h+r.h)/2))continue;
    chosen=next;found=true;break;
   }
   occupied.push({...chosen,w,h});
   const target=new T.Vector3(chosen.x/width*2-1,1-chosen.y/height*2,point.z).unproject(camera);label.position.copy(root.worldToLocal(target));
   line.visible=Math.abs(chosen.x-x)+Math.abs(chosen.y-y)>1;
   const positions=line.geometry.getAttribute('position') as T.BufferAttribute;positions.setXYZ(0,anchor.x,anchor.y,anchor.z);positions.setXYZ(1,label.position.x,label.position.y,label.position.z);positions.needsUpdate=true;
  }
 }
 clear(){
  this.group.traverse(object=>{const mesh=object as T.Mesh;if(object instanceof T.Mesh||object instanceof T.Line)object.geometry.dispose();const materials=(Array.isArray(mesh.material)?mesh.material:[mesh.material]).filter(Boolean);for(const material of materials){(material as T.SpriteMaterial).map?.dispose();material.dispose();}});
  this.group.clear();this.steps=[];this.labels=[];this.signature='';this.layoutStamp='';
 }
}
