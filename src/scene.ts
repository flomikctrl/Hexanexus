import * as T from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {allCells, key,type Mat, type Vec} from './math';
import {equal} from './projections';
import type {Puzzle} from './state';
import {cellStyle,cellColors,blockAppearance,removalHighlight,type ProjectionMode} from './presentation';
import {PointerTapGesture,type Tool} from './interaction';
import {neighborFromNormal} from './connectivity';
import {HintOverlay} from './hint-overlay';
import type {NumberedHint} from './hint-path';

const matrix=(m:Mat)=>new T.Matrix4().makeBasis(new T.Vector3(...m[0]),new T.Vector3(...m[1]),new T.Vector3(...m[2]));
export class Scene {
  renderer=new T.WebGLRenderer({antialias:true}); scene=new T.Scene(); camera=new T.PerspectiveCamera(40,1,.1,100);
  controls:OrbitControls; group=new T.Group(); panels:T.Group[]=[]; ray=new T.Raycaster(); mouse=new T.Vector2();
  objects:T.Mesh[]=[]; target=new T.Quaternion(); hover:T.Mesh|null=null; busy=false; start=0; from=new T.Quaternion();
  onCell:(p:Vec)=>void=()=>{}; onSettled:()=>void=()=>{}; down={x:0,y:0}; destroyed=false;
  geometry=new RoundedBoxGeometry(.91,.91,.91,2,.055); edgeGeometry=new T.EdgesGeometry(new T.BoxGeometry(.93,.93,.93));
  sparks:T.Points; reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  lastOccupied=new Set<string>(); fading:T.Mesh[]=[]; effectStart=0;
  showEmpty=false;
  tool:Tool='place';remaining=0;editing=false;menu=true;gesture=new PointerTapGesture();
  decoration=new T.Group();directions=new T.Group();
  puzzle:Puzzle|null=null;
  hints=new HintOverlay();
  hintViewport=new T.Vector2();
  constructor(public host:HTMLElement){
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=T.PCFSoftShadowMap;
    this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.65;host.append(this.renderer.domElement);
    this.scene.background=new T.Color('#1b3339');this.scene.fog=new T.FogExp2('#1b3339',.025);
    this.controls=new OrbitControls(this.camera,this.renderer.domElement);this.controls.enableDamping=true;this.controls.dampingFactor=.08;this.controls.enablePan=false;this.controls.minDistance=6;this.controls.maxDistance=13;this.controls.minPolarAngle=.05;this.controls.maxPolarAngle=Math.PI-.05;this.resetCamera();
    this.scene.add(new T.HemisphereLight(0xd4fff3,0x718b88,2.6));
    const fill=new T.DirectionalLight(0x8dded7,2.4);fill.position.set(-4,3,6);this.scene.add(fill);
    const light=new T.DirectionalLight(0xc1eee7,3);light.position.set(3,8,5);light.castShadow=true;light.shadow.mapSize.set(2048,2048);light.shadow.camera.left=-9;light.shadow.camera.right=9;light.shadow.camera.top=9;light.shadow.camera.bottom=-9;this.scene.add(light);
    for(const x of [-4,4]){const l=new T.PointLight(0xffbd54,35,12,2);l.position.set(x,2,-2);this.scene.add(l);}
    // A dim decorative ring has no depth mask and is never an input target.
    const ring=new T.Mesh(new T.TorusGeometry(2.6,.018,6,80),new T.MeshBasicMaterial({color:0x8c7441,transparent:true,opacity:.35,depthWrite:false}));ring.rotation.x=-Math.PI/2;ring.position.y=-2.36;ring.raycast=()=>{};this.scene.add(ring);
    this.scene.add(this.group,this.hints.group);
    for(let s=0;s<2;s++){
      const panel=new T.Group();panel.position.set(s===0?0:-2.25,0,s===0?-2.25:0);panel.rotation.y=s===0?0:-Math.PI/2;
      const backing=new T.Mesh(new T.BoxGeometry(2.55,2.55,.1),new T.MeshStandardMaterial({color:0x292b22,metalness:.7,roughness:.5}));panel.add(backing);
      const frame=new T.LineSegments(new T.EdgesGeometry(new T.BoxGeometry(2.65,2.65,.15)),new T.LineBasicMaterial({color:0xffcf71}));panel.add(frame);this.panels.push(panel);this.scene.add(panel);
    }
    this.directions.add(new T.ArrowHelper(new T.Vector3(0,0,-1),new T.Vector3(1.7,-1.8,1.2),2.7,0xe8cb81,.18,.1));
    this.directions.add(new T.ArrowHelper(new T.Vector3(-1,0,0),new T.Vector3(1.2,-1.8,1.7),2.7,0xe8cb81,.18,.1));this.scene.add(this.directions);
    for(const cell of [[-1,-1,0],[0,-1,0],[1,-1,0],[-1,0,0],[1,0,0],[-1,1,0],[0,1,0],[1,1,0],[0,0,-1]] as Vec[]){
      const cube=new T.Mesh(this.geometry,new T.MeshStandardMaterial({color:0x3c9b92,metalness:.6,roughness:.3,emissive:0x164b42,emissiveIntensity:.35}));cube.position.set(...cell);cube.castShadow=true;cube.add(new T.LineSegments(this.edgeGeometry,new T.LineBasicMaterial({color:0x98cfb7})));this.decoration.add(cube);
    }this.decoration.position.set(1,.25,0);this.scene.add(this.decoration);
    const points=new Float32Array(240);for(let i=0;i<points.length;i++)points[i]=(Math.random()-.5)*14;
    const geo=new T.BufferGeometry();geo.setAttribute('position',new T.BufferAttribute(points,3));this.sparks=new T.Points(geo,new T.PointsMaterial({color:0xffd88e,size:.025,transparent:true,opacity:.6}));this.scene.add(this.sparks);
    const canvas=this.renderer.domElement;
    // Holding the scene is a game gesture, not a browser selection/context menu.
    canvas.addEventListener('contextmenu',e=>e.preventDefault());
    canvas.addEventListener('pointerdown',e=>{if(e.button!==0||this.menu)return;this.gesture.begin(e.pointerId,e.clientX,e.clientY);this.pick(e);});
    canvas.addEventListener('pointermove',e=>{this.gesture.move(e.pointerId,e.clientX,e.clientY);this.pick(e);});
    canvas.addEventListener('pointerup',e=>{if(e.button!==0||this.menu)return;const click=this.gesture.end(e.pointerId,e.clientX,e.clientY);if(click&&!this.busy){this.pick(e);if(this.hover)this.onCell(this.hover.userData.cell);}});
    canvas.addEventListener('pointerleave',()=>{this.gesture.cancel();this.clearHover();});
    canvas.addEventListener('pointercancel',()=>{this.gesture.cancel();this.clearHover();});
    new ResizeObserver(()=>this.resize()).observe(host);this.resize();this.frame();
  }
  resize(){const {width,height}=this.host.getBoundingClientRect();this.camera.aspect=width/Math.max(height,1);this.camera.fov=T.MathUtils.radToDeg(2*Math.atan(Math.tan(T.MathUtils.degToRad(20))*Math.max(1,.95/this.camera.aspect)));this.camera.updateProjectionMatrix();this.renderer.setSize(width,height);}
  resetCamera(){const damping=this.controls.enableDamping;this.controls.enableDamping=false;this.controls.update();this.controls.target.set(0,0,0);this.camera.position.set(6,4.8,7.6);this.controls.update();this.controls.enableDamping=damping;}
  setMenu(value:boolean){const wasMenu=this.menu;this.menu=value;this.group.visible=!value;if(this.hints)this.hints.group.visible=!value&&this.hints.count>0;this.panels.forEach(p=>p.visible=!value);this.decoration.visible=value;this.controls.enabled=!value;this.clearHover();this.gesture.cancel();if(value||wasMenu)this.resetCamera();}
  setInteraction(tool:Tool,remaining:number,editing=false){this.clearHover();this.tool=tool;this.remaining=remaining;this.editing=editing;}
  setHints(steps:NumberedHint[]){this.hints.set(steps,this.puzzle?.cells??[]);this.hints.group.quaternion.copy(this.group.quaternion);this.hints.group.visible=!this.menu&&steps.length>0;}
  clearHover(){if(this.hover){const material=this.hover.material as T.MeshStandardMaterial;material.emissiveIntensity=this.hover.userData.emission;material.emissive.setHex(this.hover.userData.emissive);if(this.hover.userData.empty){const visible=this.showEmpty&&(this.editing||!!this.puzzle?.canPlace(this.hover.userData.cell));material.opacity=visible?.09:0;this.hover.children[0].visible=visible;}this.hover=null;}}
  preview(cell:Vec|null){
    this.clearHover();if(!cell||this.busy||this.menu)return;
    const cube=this.objects.find(o=>key(o.userData.cell)===key(cell));if(!cube)return;
    if(!this.editing&&(this.tool==='place'?(!cube.userData.empty||!this.puzzle?.canPlace(cell)):cube.userData.empty))return;
    this.hover=cube;const material=cube.material as T.MeshStandardMaterial;material.emissiveIntensity=.9;
    if(this.tool==='remove'&&!this.editing)material.emissive.setHex(removalHighlight(cube.userData.fixed,!!this.puzzle?.canRemove(cell)));
    if(cube.userData.empty){material.opacity=.38;cube.children[0].visible=true;}
  }
  pick(e:PointerEvent){
    this.clearHover();const r=this.renderer.domElement.getBoundingClientRect();this.mouse.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);this.ray.setFromCamera(this.mouse,this.camera);
    if(this.busy||this.menu)return;
    this.group.updateWorldMatrix(true,true);
    const hits=this.ray.intersectObjects(this.objects.filter(o=>o.visible&&(this.editing||!o.userData.empty||this.tool==='place'&&this.showEmpty&&!!this.puzzle?.canPlace(o.userData.cell))),false);
    const hit=hits[0];
    if(hit){
      if(this.editing||this.tool==='remove'||hit.object.userData.empty)this.preview(hit.object.userData.cell);
      else if(hit.face){
        // face.normal is in the cube's local axes, just like grid coordinates.
        // Dominant-axis snapping handles the small bevels of RoundedBoxGeometry.
        const cell=neighborFromNormal(hit.object.userData.cell,hit.face.normal.toArray() as Vec);
        if(cell)this.preview(cell);
      }
    }
    this.renderer.domElement.style.cursor=this.hover?'pointer':'grab';
  }
  sync(p:Puzzle,animate=false,showEmpty=false,mode:ProjectionMode='training'){
    this.clearHover();
    this.puzzle=p;
    this.showEmpty=showEmpty;
    const occupied=new Set(p.cells.map(key));
    for(const old of this.fading){this.scene.remove(old);this.disposeCube(old);}this.fading=[];
    for(const child of [...this.group.children]){
      if(child instanceof T.Mesh&&this.lastOccupied.has(key(child.userData.cell))&&!occupied.has(key(child.userData.cell))&&!this.reduced){
        child.updateWorldMatrix(true,false);const world=child.matrixWorld.clone();this.group.remove(child);this.scene.add(child);world.decompose(child.position,child.quaternion,child.scale);this.fading.push(child);
      }else{this.group.remove(child);this.disposeCube(child);}
    }
    this.objects=[];
    for(const cell of allCells){
      const fixed=p.level.fixed.some(v=>key(v)===key(cell));const placed=p.placed.some(v=>key(v)===key(cell));const available=p.level.available.some(v=>key(v)===key(cell));
      if(!fixed&&!placed&&!available)continue;
      const full=fixed||placed;
      const appearance=fixed?blockAppearance.fixed:blockAppearance.player;
      const material=new T.MeshStandardMaterial({color:full?appearance.body:0x7de4c5,metalness:full?.42:.1,roughness:.4,emissive:full?appearance.emissive:0x276b60,emissiveIntensity:full?appearance.emission:.3,transparent:!full,opacity:full?1:showEmpty?.09:0,depthWrite:full});
      const cube=new T.Mesh(this.geometry,material);cube.position.set(...cell);cube.castShadow=full;cube.receiveShadow=full;cube.userData={cell,empty:!full,fixed,placed,emissive:material.emissive.getHex(),emission:material.emissiveIntensity};
      const edges=new T.LineSegments(this.edgeGeometry,new T.LineBasicMaterial({color:full?appearance.edge:0x98ebc8,transparent:true,opacity:full?.8:.55}));edges.visible=full||showEmpty&&(this.editing||p.canPlace(cell));cube.add(edges);
      if(!full&&!this.editing&&!p.canPlace(cell))material.opacity=0;
      if(full){
        const cornerGeo=new T.BoxGeometry(.12,.12,.12);const cornerMat=new T.MeshStandardMaterial({color:appearance.corner,metalness:.85,roughness:.25});
        for(const x of [-.43,.43])for(const y of [-.43,.43])for(const z of [-.43,.43]){const c=new T.Mesh(cornerGeo,cornerMat);c.position.set(x,y,z);cube.add(c);}
      }
      this.group.add(cube);this.objects.push(cube);
    }
    this.lastOccupied=occupied;this.effectStart=performance.now();
    this.target.setFromRotationMatrix(matrix(p.orientation));
    if(animate&&!this.reduced){this.from.copy(this.group.quaternion);this.start=performance.now();this.busy=true;}else{this.group.quaternion.copy(this.target);this.busy=false;}
    this.updateProjections(p,mode);
  }
  updateProjections(p:Puzzle,mode:ProjectionMode){
    const current=p.projections;
    this.panels.forEach((panel,s)=>{
      for(let i=0;i<9;i++){
        const style=cellStyle(p.level.targets[s][i],current[s][i],mode);const color=cellColors[style];
        let tile=panel.children[i+2] as T.Mesh<T.BoxGeometry,T.MeshBasicMaterial>|undefined;
        if(!tile){tile=new T.Mesh(new T.BoxGeometry(.67,.67,.08),new T.MeshBasicMaterial({toneMapped:false}));tile.position.set((i%3-1)*.77,(1-Math.floor(i/3))*.77,s===0?.11:-.11);panel.add(tile);}
        tile.userData.style=style;tile.material.color.setHex(color);
      }
      ((panel.children[1] as T.LineSegments).material as T.LineBasicMaterial).color.set(mode==='training'&&equal(current[s],p.level.targets[s])?0x9fffd2:0xffcf71);
    });
    this.directions.visible=!this.menu&&mode==='training';
  }
  disposeCube(child:T.Object3D){
    const geometries=new Set<T.BufferGeometry>(),materials=new Set<T.Material>();
    child.traverse(o=>{if(o instanceof T.Mesh||o instanceof T.LineSegments){if(o.geometry!==this.geometry&&o.geometry!==this.edgeGeometry)geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);}});
    geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());
  }
  frame=()=>{
    if(this.destroyed)return;requestAnimationFrame(this.frame);this.controls.update();
    if(this.busy){const t=Math.min((performance.now()-this.start)/420,1);this.group.quaternion.slerpQuaternions(this.from,this.target,t*t*(3-2*t));if(t===1){this.busy=false;this.onSettled();}}
    const effect=Math.min((performance.now()-this.effectStart)/250,1);
    for(const cube of this.fading)cube.scale.setScalar(Math.max(.001,1-effect));
    if(effect===1){for(const cube of this.fading){this.scene.remove(cube);this.disposeCube(cube);}this.fading=[];}
    if(!this.reduced){this.sparks.rotation.y+=.0003;if(this.menu)this.decoration.rotation.y+=.002;}
    this.hints.group.quaternion.copy(this.group.quaternion);
    this.renderer.getSize(this.hintViewport);this.hints.layout(this.camera,this.hintViewport.x,this.hintViewport.y);
    this.renderer.render(this.scene,this.camera);
  };
}
