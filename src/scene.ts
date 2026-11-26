import {VictoryPresentation,victoryDuration} from './victory-presentation';
import * as T from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {gridCells, key,type Mat, type Vec} from './math';
import {equal} from './projections';
import type {Puzzle} from './state';
import {cellStyle,cellColors,blockAppearance,type ProjectionMode} from './presentation';
import {PointerTapGesture,type Tool} from './interaction';
import {neighborFromNormal} from './connectivity';
import {HintOverlay} from './hint-overlay';
import type {NumberedHint} from './hint-path';
import {LobbyRotation} from './lobby-rotation';
import {FrameLoop} from './frame-loop';
import {createLobbyFigure} from './lobby-figure';

const matrix=(m:Mat)=>new T.Matrix4().makeBasis(new T.Vector3(...m[0]),new T.Vector3(...m[1]),new T.Vector3(...m[2]));
export class Scene {
  renderer=new T.WebGLRenderer({antialias:true}); scene=new T.Scene(); camera=new T.PerspectiveCamera(40,1,.1,100);
  controls:OrbitControls; group=new T.Group(); panels:T.Group[]=[]; ray=new T.Raycaster(); mouse=new T.Vector2();
  objects:T.Mesh[]=[]; target=new T.Quaternion(); hover:T.Mesh|null=null; busy=false; start=0; from=new T.Quaternion();
  onCell:(p:Vec)=>void=()=>{}; onSettled:()=>void=()=>{}; down={x:0,y:0}; destroyed=false;
  onCameraRotate:()=>void=()=>{};
  private cameraAtPress=new T.Quaternion();
  private celebrationAt:number|null=null;
  private victoryPresentation=new VictoryPresentation();
  private controlsBeforeVictory=true;
  private directionsBeforeVictory=false;
  private mobile=false;
  geometry=new RoundedBoxGeometry(.91,.91,.91,2,.055); edgeGeometry=new T.EdgesGeometry(new T.BoxGeometry(.93,.93,.93));
  cornerGeometry=new T.BoxGeometry(.12,.12,.12);
  sparks:T.Points; reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  showEmpty=false;
  tool:Tool='place';remaining=0;editing=false;menu=true;gesture=new PointerTapGesture();
  decoration=new T.Group();directions=new T.Group();
  puzzle:Puzzle|null=null;
  hints=new HintOverlay();
  hintViewport=new T.Vector2();
  lobbyRotation=new LobbyRotation();
  private loop:FrameLoop;
  private observer:ResizeObserver;
  private listeners=new AbortController();
  private appActive=true;
  private lastFrame=0;
  constructor(public host:HTMLElement){
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=T.PCFSoftShadowMap;
    this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.65;host.append(this.renderer.domElement);
    this.scene.background=new T.Color('#152e32');this.scene.fog=new T.FogExp2('#152e32',.025);
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
    this.decoration=createLobbyFigure(this.geometry,this.edgeGeometry);this.scene.add(this.decoration);
    const points=new Float32Array(240);for(let i=0;i<points.length;i++)points[i]=(Math.random()-.5)*14;
    const geo=new T.BufferGeometry();geo.setAttribute('position',new T.BufferAttribute(points,3));this.sparks=new T.Points(geo,new T.PointsMaterial({color:0xffd88e,size:.025,transparent:true,opacity:.6}));this.scene.add(this.sparks);
    this.bindInput(this.renderer.domElement);
    this.loop=new FrameLoop(this.frame);document.addEventListener('visibilitychange',()=>this.updateLoop(),{signal:this.listeners.signal});
    this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(host);this.resize();this.updateLoop();
  }
  private bindInput(canvas:HTMLCanvasElement){
    // Restored from b8b0e08b8e7d7ad66592ce1501594741a462d881; the tutorial only observes camera rotation.
    const options={signal:this.listeners.signal};
    canvas.addEventListener('contextmenu',e=>e.preventDefault(),options);
    canvas.addEventListener('pointerdown',e=>{if(e.button!==0)return;if(this.menu){if(this.lobbyRotation.begin(e.pointerId,e.clientX,e.clientY,e.timeStamp)){e.preventDefault();canvas.setPointerCapture(e.pointerId);canvas.style.cursor='grabbing';}return;}this.gesture.begin(e.pointerId,e.clientX,e.clientY);this.cameraAtPress.copy(this.camera.quaternion);this.pick(e);},options);
    canvas.addEventListener('pointermove',e=>{if(this.menu){this.lobbyRotation.move(e.pointerId,e.clientX,e.clientY,e.timeStamp);return;}this.gesture.move(e.pointerId,e.clientX,e.clientY);this.pick(e);},options);
    canvas.addEventListener('pointerup',e=>{if(e.button!==0)return;if(this.menu){this.lobbyRotation.end(e.pointerId,e.timeStamp);if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);canvas.style.cursor='grab';return;}const click=this.gesture.end(e.pointerId,e.clientX,e.clientY);if(this.cameraAtPress.angleTo(this.camera.quaternion)>.03)this.onCameraRotate();if(click&&!this.busy){this.pick(e);if(this.hover)this.onCell(this.hover.userData.cell);}},options);
    canvas.addEventListener('pointerleave',()=>{this.gesture.cancel();this.clearHover();},options);
    canvas.addEventListener('pointercancel',()=>{this.gesture.cancel();this.lobbyRotation.cancel(performance.now());this.clearHover();},options);
    canvas.addEventListener('lostpointercapture',()=>{if(this.lobbyRotation.dragging)this.lobbyRotation.cancel(performance.now());},options);
    window.addEventListener('blur',()=>this.lobbyRotation.cancel(performance.now()),options);
  }
  resize(){const {width,height}=this.host.getBoundingClientRect();this.mobile=width<768;this.camera.aspect=width/Math.max(height,1);this.camera.fov=T.MathUtils.radToDeg(2*Math.atan(Math.tan(T.MathUtils.degToRad(20))*Math.max(1,.95/this.camera.aspect)));this.camera.updateProjectionMatrix();this.renderer.getSize(this.hintViewport);if(this.hintViewport.x!==width||this.hintViewport.y!==height)this.renderer.setSize(width,height);}
  resetCamera(){const scale=this.menu?1:(this.puzzle?.size??3)/3;this.controls.minDistance=6*scale;this.controls.maxDistance=13*scale;const damping=this.controls.enableDamping;this.controls.enableDamping=false;this.controls.update();this.controls.target.set(0,0,0);this.camera.position.set(6*scale,4.8*scale,7.6*scale);this.controls.update();this.controls.enableDamping=damping;}
  setMenu(value:boolean){const wasMenu=this.menu;this.menu=value;this.group.visible=!value;if(this.hints)this.hints.group.visible=!value&&this.hints.count>0;this.panels.forEach(p=>p.visible=!value);this.decoration.visible=value;this.controls.enabled=!value;this.renderer.shadowMap.enabled=!value;const ratio=Math.min(devicePixelRatio,value?1.5:2);if(this.renderer.getPixelRatio()!==ratio)this.renderer.setPixelRatio(ratio);this.clearHover();this.gesture.cancel();if(value||wasMenu)this.resetCamera();}
  setAppActive(active:boolean){this.appActive=active;if(!active)this.cancelInput();this.updateLoop();}
  private updateLoop(){const active=this.appActive&&!document.hidden;this.lobbyRotation.suspend(!active,performance.now());this.lastFrame=0;if(active)this.loop.start();else{this.loop.pause();this.cancelInput();this.lobbyRotation.cancel(performance.now());}}
  setLobbyRegion(bounds:DOMRect|null){
    const entering=!!bounds&&!this.lobbyRotation.active;
    this.lobbyRotation.setActive(!!bounds,performance.now());
    if(bounds){
      Object.assign(this.host.style,{left:bounds.left+'px',top:bounds.top+'px',width:bounds.width+'px',height:bounds.height+'px',right:'auto',bottom:'auto'});
      this.decoration.position.set(0,0,0);
      if(entering){this.camera.position.set(6,4.8,7.6).normalize().multiplyScalar(6.2);this.controls.target.set(0,0,0);this.controls.update();}
      this.renderer.domElement.style.cursor='grab';
    }else{
      for(const name of ['left','top','width','height','right','bottom'])this.host.style.removeProperty(name);
      this.decoration.position.set(1,.25,0);this.resetCamera();
    }
    this.resize();
  }
  cancelInput(){this.gesture.cancel();}
  celebrate(active:boolean){
    if(active){if(this.celebrationAt!==null)return;this.cancelInput();this.clearHover();this.controlsBeforeVictory=this.controls.enabled;this.directionsBeforeVictory=this.directions.visible;this.controls.enabled=false;this.directions.visible=false;this.celebrationAt=performance.now();this.victoryPresentation.start(this.group,this.panels,this.camera,this.celebrationAt,this.reduced);}
    else if(this.celebrationAt!==null){this.victoryPresentation.cancel();this.celebrationAt=null;this.controls.enabled=this.controlsBeforeVictory;this.directions.visible=this.directionsBeforeVictory;for(const cube of this.objects)if(!cube.userData.empty)(cube.material as T.MeshStandardMaterial).emissiveIntensity=cube.userData.emission;}
  }
  setInteraction(tool:Tool,remaining:number,editing=false){this.clearHover();this.tool=tool;this.remaining=remaining;this.editing=editing;}
  setHints(steps:NumberedHint[]){this.hints.set(steps,this.puzzle?.cells??[]);this.hints.group.quaternion.copy(this.group.quaternion);this.hints.group.visible=!this.menu&&steps.length>0;}
  clearHover(){if(this.hover){const material=this.hover.material as T.MeshStandardMaterial;material.emissiveIntensity=this.hover.userData.emission;material.emissive.setHex(this.hover.userData.emissive);if(this.hover.userData.empty){const visible=this.showEmpty&&(this.editing||!!this.puzzle?.canPlace(this.hover.userData.cell));material.opacity=visible?.09:0;this.hover.children[0].visible=visible;}this.hover=null;}}
  preview(cell:Vec|null){
    this.clearHover();if(!cell||this.busy||this.menu)return;
    const cube=this.objects.find(o=>key(o.userData.cell)===key(cell));if(!cube)return;
    if(!this.editing&&(this.tool==='place'?(!cube.userData.empty||!this.puzzle?.canPlace(cell)):cube.userData.empty))return;
    this.hover=cube;const material=cube.material as T.MeshStandardMaterial;
    if(cube.userData.empty)material.emissiveIntensity=this.mobile?.38:.5;
    if(cube.userData.empty){material.opacity=.38;cube.children[0].visible=true;}
  }
  pick(e:PointerEvent){
    this.clearHover();const r=this.renderer.domElement.getBoundingClientRect();this.mouse.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);this.ray.setFromCamera(this.mouse,this.camera);
    if(this.busy||this.menu||this.celebrationAt!==null&&this.celebrationAt!==undefined)return;
    this.group.updateWorldMatrix(true,true);
    const hits=this.ray.intersectObjects(this.objects.filter(o=>o.visible&&(this.editing||!o.userData.empty)),false);
    const hit=hits[0];
    let empty:T.Intersection|undefined;
    if(!this.editing&&this.tool==='place'){
      const candidates=this.ray.intersectObjects(this.objects.filter(o=>o.visible&&o.userData.empty&&this.puzzle?.canPlace(o.userData.cell)),false);
      if(!hit)empty=candidates[0];
      else{
        // An occupied cube behind a vacant cell must not swallow a tap aimed at
        // that cell. Compare projected centres to retain taps on the cube
        // itself; never select a vacant cell hidden behind an occupied surface.
        const distance=(o:T.Object3D)=>{const p=o.getWorldPosition(new T.Vector3()).project(this.camera);return (p.x-this.mouse.x)**2+(p.y-this.mouse.y)**2;};
        let nearest=distance(hit.object);
        for(const candidate of candidates){const d=distance(candidate.object);if(candidate.distance<hit.distance-1e-4&&d<nearest-1e-8){empty=candidate;nearest=d;}}
      }
    }
    if(empty)this.preview(empty.object.userData.cell);
    else if(hit){
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
    const resized=(this.puzzle?.size??3)!==p.size;this.puzzle=p;if(resized&&!this.menu)this.resetCamera();
    this.showEmpty=showEmpty;
    for(const child of [...this.group.children]){
      this.group.remove(child);this.disposeCube(child);
    }
    this.objects=[];
    for(const cell of gridCells(p.size)){
      const fixed=p.level.fixed.some(v=>key(v)===key(cell));const placed=p.placed.some(v=>key(v)===key(cell));const available=p.level.available.some(v=>key(v)===key(cell));
      if(!fixed&&!placed&&!available)continue;
      const full=fixed||placed;
      const appearance=fixed?blockAppearance.fixed:blockAppearance.player;
      const material=new T.MeshStandardMaterial({color:full?appearance.body:0x7de4c5,metalness:full?.42:.1,roughness:.4,emissive:full?appearance.emissive:0x276b60,emissiveIntensity:full?appearance.emission:.3,transparent:!full,opacity:full?1:showEmpty?.09:0,depthWrite:full});
      const cube=new T.Mesh(this.geometry,material);cube.position.set(...cell);cube.castShadow=full;cube.receiveShadow=full;cube.userData={cell,empty:!full,fixed,placed,emissive:material.emissive.getHex(),emission:material.emissiveIntensity};
      const edges=new T.LineSegments(this.edgeGeometry,new T.LineBasicMaterial({color:full?appearance.edge:0x98ebc8,transparent:true,opacity:full?.55:.4,depthTest:true,depthWrite:false}));edges.visible=full||showEmpty&&(this.editing||p.canPlace(cell));cube.add(edges);
      if(!full&&!this.editing&&!p.canPlace(cell))material.opacity=0;
      if(full){
        const cornerMat=new T.MeshStandardMaterial({color:appearance.corner,metalness:.85,roughness:.25}),corners=new T.InstancedMesh(this.cornerGeometry,cornerMat,8),transform=new T.Matrix4();let i=0;
        for(const x of [-.43,.43])for(const y of [-.43,.43])for(const z of [-.43,.43]){transform.makeTranslation(x,y,z);corners.setMatrixAt(i++,transform);}cube.add(corners);
      }
      this.group.add(cube);this.objects.push(cube);
    }
    this.target.setFromRotationMatrix(matrix(p.orientation));
    if(animate&&!this.reduced){this.from.copy(this.group.quaternion);this.start=performance.now();this.busy=true;}else{this.group.quaternion.copy(this.target);this.busy=false;}
    this.updateProjections(p,mode);
  }
  updateProjections(p:Puzzle,mode:ProjectionMode){
    const current=p.projections,n=p.size,c=(n-1)/2,scale=3/n;
    this.panels.forEach((panel,s)=>{
      if(panel.userData.size!==n){for(const tile of panel.children.slice(2)){panel.remove(tile);this.disposeCube(tile);}panel.userData.size=n;}
      panel.scale.setScalar(n/3);panel.position.set(s===0?0:-(n/2+.75),0,s===0?-(n/2+.75):0);this.directions.scale.setScalar(n/3);
      for(let i=0;i<n*n;i++){
        const style=cellStyle(p.level.targets[s][i],current[s][i],mode);const color=cellColors[style];
        let tile=panel.children[i+2] as T.Mesh<T.BoxGeometry,T.MeshBasicMaterial>|undefined;
        if(!tile){tile=new T.Mesh(new T.BoxGeometry(.67*scale,.67*scale,.08),new T.MeshBasicMaterial({toneMapped:false}));tile.position.set((i%n-c)*.77*scale,(c-Math.floor(i/n))*.77*scale,s===0?.11:-.11);panel.add(tile);}
        tile.userData.style=style;tile.material.color.setHex(color);
      }
      ((panel.children[1] as T.LineSegments).material as T.LineBasicMaterial).color.set(mode==='training'&&equal(current[s],p.level.targets[s])?0x9fffd2:0xffcf71);
    });
    this.directions.visible=!this.menu&&mode==='training';
  }
  disposeCube(child:T.Object3D){
    const geometries=new Set<T.BufferGeometry>(),materials=new Set<T.Material>();
    child.traverse(o=>{if(o instanceof T.Mesh||o instanceof T.LineSegments){if(o.geometry!==this.geometry&&o.geometry!==this.edgeGeometry&&o.geometry!==this.cornerGeometry)geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);if(o instanceof T.InstancedMesh)o.dispose();}});
    geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());
  }
  frame=()=>{
    if(this.destroyed)return;
    const now=performance.now(),delta=this.lastFrame?Math.min(.1,Math.max(0,(now-this.lastFrame)/1000)):0;this.lastFrame=now;
    if(this.celebrationAt!==null){this.victoryPresentation.update(now);const glow=(this.reduced?.03:.09)*Math.sin(Math.min(1,(now-this.celebrationAt)/victoryDuration)*Math.PI);for(const cube of this.objects)if(!cube.userData.empty)(cube.material as T.MeshStandardMaterial).emissiveIntensity=cube.userData.emission+glow;}
    if(!this.menu&&this.celebrationAt===null)this.controls.update();
    if(this.busy){const t=Math.min((performance.now()-this.start)/420,1);this.group.quaternion.slerpQuaternions(this.from,this.target,t*t*(3-2*t));if(t===1){this.busy=false;this.onSettled();}}
    if(!this.reduced)this.sparks.rotation.y+=.018*delta;
    if(this.lobbyRotation.active){this.lobbyRotation.suspend(!!document.querySelector('dialog[open]'),now);this.lobbyRotation.step(now,this.reduced);this.decoration.rotation.set(0,this.lobbyRotation.yaw,0);}
    if(!this.menu){this.hints.group.quaternion.copy(this.group.quaternion);this.renderer.getSize(this.hintViewport);this.hints.layout(this.camera,this.hintViewport.x,this.hintViewport.y);}
    this.renderer.render(this.scene,this.camera);
  };
  dispose(){
    if(this.destroyed)return;this.destroyed=true;this.celebrate(false);this.cancelInput();this.loop.dispose();this.observer.disconnect();this.listeners.abort();this.controls.dispose();
    this.hints.set([],[]);
    const geometries=new Set<T.BufferGeometry>(),materials=new Set<T.Material>();
    this.scene.traverse(o=>{if(o instanceof T.Mesh||o instanceof T.LineSegments||o instanceof T.Points){geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);if(o instanceof T.InstancedMesh)o.dispose();}});
    geometries.add(this.geometry);geometries.add(this.edgeGeometry);geometries.add(this.cornerGeometry);this.scene.traverse(o=>{if(o instanceof T.Light)(o as T.DirectionalLight).shadow?.map?.dispose();});
    geometries.forEach(g=>g.dispose());materials.forEach(m=>{const map=(m as T.MeshBasicMaterial).map;map?.dispose();m.dispose();});this.renderer.dispose();this.renderer.domElement.remove();
  }
}
