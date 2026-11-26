import * as T from 'three';
export const victoryDuration=3000;
const ease=(x:number)=>(1-Math.cos(Math.PI*T.MathUtils.clamp(x,0,1)))/2;
/** Presentation transforms only. Never changes puzzle coordinates/orientation. */
export class VictoryPresentation {
 private state:{figure:T.Group;rotation:T.Quaternion;scale:T.Vector3;fit:number;start:number;reduced:boolean;panels:{object:T.Group;position:T.Vector3;visible:boolean;direction:T.Vector3;materials:{material:T.Material;opacity:number;transparent:boolean;depthWrite:boolean}[]}[]} |null=null;
 start(figure:T.Group,panels:T.Group[],camera:T.PerspectiveCamera,now:number,reduced=false){
  if(this.state)return;
  figure.updateWorldMatrix(true,true);camera.updateMatrixWorld();
  const origin=figure.getWorldPosition(new T.Vector3()),distance=camera.position.distanceTo(origin);
  const vertical=T.MathUtils.degToRad(camera.fov),horizontal=2*Math.atan(Math.tan(vertical/2)*camera.aspect);
  const radius=Math.max(.9,...figure.children.filter(o=>!o.userData.empty).map(o=>o.position.length()+Math.sqrt(3)*.5));
  const fit=Math.min(1,distance*Math.sin(Math.min(vertical,horizontal)/2)*.92/radius);
  const right=new T.Vector3().setFromMatrixColumn(camera.matrixWorld,0);right.y=0;right.normalize();
  const leftmost=[...panels].sort((a,b)=>a.getWorldPosition(new T.Vector3()).project(camera).x-b.getWorldPosition(new T.Vector3()).project(camera).x)[0];
  this.state={figure,rotation:figure.quaternion.clone(),scale:figure.scale.clone(),fit,start:now,reduced,panels:panels.map(object=>{
   const materials:{material:T.Material;opacity:number;transparent:boolean;depthWrite:boolean}[]=[];
   object.traverse(o=>{const m=(o as T.Mesh).material;if(m)for(const material of Array.isArray(m)?m:[m]){if(materials.some(s=>s.material===material))continue;materials.push({material,opacity:material.opacity,transparent:material.transparent,depthWrite:material.depthWrite});material.transparent=true;material.depthWrite=false;material.needsUpdate=true;}});
   return{object,position:object.position.clone(),visible:object.visible,direction:right.clone().multiplyScalar(object===leftmost?-1:1),materials};
  })};
 }
 update(now:number){const s=this.state;if(!s)return;const t=Math.max(0,now-s.start),out=ease(t/550),spin=ease((t-550)/2000),back=ease((t-2550)/450);
  for(const panel of s.panels){panel.object.position.copy(panel.position).addScaledVector(panel.direction,out*3);panel.object.visible=panel.visible&&t<550;for(const m of panel.materials)m.material.opacity=m.opacity*(1-out);}
  const turn=s.reduced?0:spin*Math.PI*2;
  s.figure.quaternion.copy(s.rotation);if(t<2550)s.figure.quaternion.premultiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),turn));
  s.figure.scale.copy(s.scale).multiplyScalar(1+(s.fit-1)*out*(1-back));
 }
 cancel(){const s=this.state;if(!s)return;s.figure.quaternion.copy(s.rotation);s.figure.scale.copy(s.scale);for(const p of s.panels){p.object.position.copy(p.position);p.object.visible=p.visible;for(const m of p.materials){m.material.opacity=m.opacity;m.material.transparent=m.transparent;m.material.depthWrite=m.depthWrite;m.material.needsUpdate=true;}}this.state=null;}
}
