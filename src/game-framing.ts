import * as T from 'three';
// Change only the lens composition, never the orbit pose, target or limits.
export function frameGame(camera:T.PerspectiveCamera,width:number,height:number,game:boolean){
 const portrait=game&&width<768&&height>width*1.25;
 camera.aspect=width/Math.max(height,1);
 camera.fov=T.MathUtils.radToDeg(2*Math.atan(Math.tan(T.MathUtils.degToRad(20))*Math.max(1,(portrait?.86:.95)/camera.aspect)));
 if(portrait)camera.setViewOffset(width,height,0,Math.round(height*.055),width,height);else camera.clearViewOffset();
 camera.updateProjectionMatrix();
}
