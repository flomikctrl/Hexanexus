import {describe,it,expect} from 'vitest';
import * as T from 'three';
import {Scene} from './scene';
import {Puzzle} from './state';
import {levels,type Level} from './levels';
import {identity,type Vec} from './math';
import {project} from './projections';
import {blockAppearance,cellColors,diagnose} from './presentation';

describe('Изменение только представления сцены',()=>{
  it('переключает диагностику на существующих панелях, сохраняя модель и сетку',()=>{
    const p=new Puzzle(levels[0]);p.place([1,0,0]);const before=JSON.stringify(p);
    // Exercise the actual rendering methods without constructing a WebGL context.
    const view=Object.create(Scene.prototype) as Scene;
    view.panels=[new T.Group(),new T.Group()];view.directions=new T.Group();view.menu=false;view.group=new T.Group();view.group.add(new T.Mesh());
    for(const panel of view.panels){panel.add(new T.Mesh(),new T.LineSegments(new T.BufferGeometry(),new T.LineBasicMaterial()));}
    view.updateProjections(p,'normal');const panelRefs=view.panels.map(panel=>[...panel.children]);const cube=view.group.children[0];
    view.updateProjections(p,'training');const result=diagnose(p.level.targets,p.projections);
    view.panels.forEach((panel,s)=>panel.children.slice(2).forEach((tile,i)=>{expect(tile).toBe(panelRefs[s][i+2]);expect(tile.userData.style).toBe(result[s].styles[i]);expect(((tile as T.Mesh).material as T.MeshBasicMaterial).color.getHex()).toBe(cellColors[result[s].styles[i]]);}));
    view.updateProjections(p,'normal');expect(JSON.stringify(p)).toBe(before);expect(view.group.children[0]).toBe(cube);expect(view.panels[0].children).toEqual(panelRefs[0]);
    view.panels.forEach(panel=>expect(panel.children.slice(2).every(tile=>['goal','empty'].includes(tile.userData.style))).toBe(true));
  });
  it('сохраняет непрозрачные материалы без подсветки удаления при касании',()=>{
    const fixed:Vec=[0,0,0],player:Vec=[1,0,0];
    const l:Level={name:'Материалы',fixed:[fixed],available:[player],limit:1,orientation:identity(),targets:project([fixed,player],identity())};const p=new Puzzle(l);p.place(player);
    const before=JSON.stringify(p),view=Object.create(Scene.prototype) as Scene;
    Object.assign(view,{hover:null,busy:false,menu:false,editing:false,tool:'remove',puzzle:p,objects:[]});
    for(const [cell,isFixed] of [[fixed,true],[player,false]] as const){const appearance=isFixed?blockAppearance.fixed:blockAppearance.player;const material=new T.MeshStandardMaterial({color:appearance.body,emissive:appearance.emissive,emissiveIntensity:appearance.emission,transparent:false,opacity:1});const cube=new T.Mesh(new T.BoxGeometry(),material);cube.userData={cell,fixed:isFixed,placed:!isFixed,empty:false,emissive:appearance.emissive,emission:appearance.emission};view.objects.push(cube);}
    expect(blockAppearance.fixed.body).not.toBe(blockAppearance.player.body);expect(blockAppearance.fixed.corner).not.toBe(blockAppearance.player.corner);
    view.preview(fixed);expect(view.hover).toBe(view.objects[0]);expect((view.hover!.material as T.MeshStandardMaterial).emissive.getHex()).toBe(blockAppearance.fixed.emissive);expect(p.remove(fixed)).toBe(false);
    view.preview(player);expect(view.hover).toBe(view.objects[1]);expect((view.hover!.material as T.MeshStandardMaterial).emissive.getHex()).toBe(blockAppearance.player.emissive);
    expect((view.objects[0].material as T.MeshStandardMaterial).emissive.getHex()).toBe(blockAppearance.fixed.emissive);
    for(const cube of view.objects){const m=cube.material as T.MeshStandardMaterial;expect(m.transparent).toBe(false);expect(m.opacity).toBe(1);}
    view.clearHover();expect(JSON.stringify(p)).toBe(before);
  });
});
