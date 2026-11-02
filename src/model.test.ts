import {describe,it,expect} from 'vitest';
import {allCells,apply,identity,key,orientations,rotate,turn,type Axis,type Vec} from './math';
import {project,matches} from './projections';
import {Puzzle} from './state';
import {levels,type Level} from './levels';
import {solve} from './solver';
import {parseLevel} from './editor';

describe('Целочисленные повороты',()=>{
  for(const a of ['X','Y','Z'] as Axis[]){
    it(`четыре поворота ${a} возвращают все 27 координат`,()=>{for(const p of allCells){let v=p;for(let i=0;i<4;i++)v=turn(v,a);expect(v).toEqual(p);}});
    it(`обратный поворот ${a} компенсирует прямой`,()=>{for(const p of allCells)expect(turn(turn(p,a),a,-1)).toEqual(p);});
  }
  it('имеет ровно 24 ориентации без искажений',()=>{expect(orientations()).toHaveLength(24);for(const m of orientations())expect(new Set(allCells.map(p=>key(apply(m,p)))).size).toBe(27);});
});
describe('Проекции и победа',()=>{
  it('схлопывает глубину и сохраняет направления матриц',()=>{
    const [xy,zy]=project([[-1,1,-1],[-1,1,1],[1,-1,0]],identity());
    expect(xy.map((v,i)=>v?i:-1).filter(i=>i>=0)).toEqual([0,8]);
    expect(zy.map((v,i)=>v?i:-1).filter(i=>i>=0)).toEqual([0,2,7]);
  });
  it('поворот конструкции меняет проекции',()=>expect(matches(project([[1,0,0]],identity()),project([[1,0,0]],rotate(identity(),'Z')))).toBe(false));
  it('положение камеры не входит в математическое состояние',()=>{
    const p=new Puzzle(levels[0]);const before=structuredClone(p.projections);let camera={azimuth:0,elevation:0};camera={azimuth:1,elevation:2};expect(camera.azimuth).toBe(1);expect(p.projections).toEqual(before);
  });
  it('принимает разные конфигурации с одинаковыми силуэтами',()=>{
    const fixed:Vec[]=[[-1,0,0],[1,0,0]];
    const l:Level={name:'Альтернативы',fixed,available:[[-1,0,-1],[-1,0,1],[1,0,-1],[1,0,1]],limit:2,orientation:identity(),targets:project([...fixed,[-1,0,-1],[1,0,1]],identity())};
    const p=new Puzzle(l);p.toggle([-1,0,1]);p.toggle([1,0,-1]);expect(p.won).toBe(true);
    p.toggle([1,0,-1]);expect(p.won).toBe(false);
  });
});
describe('Действия игрока',()=>{
  it('защищает основу, блокировки и запас',()=>{
    const p=new Puzzle(levels[0]);expect(p.toggle(levels[0].fixed[0])).toBe(false);expect(p.toggle([2,-1,-1])).toBe(false);
    expect(p.toggle(levels[0].available[0])).toBe(true);expect(p.toggle(levels[0].available[1])).toBe(true);expect(p.toggle(levels[0].available[2])).toBe(false);
    expect(p.toggle(levels[0].available[0])).toBe(true);expect(p.placed).toHaveLength(1);
  });
  it('отменяет установку, удаление и поворот; сбрасывает историю',()=>{
    const p=new Puzzle(levels[0]);const c=levels[0].available[0];p.toggle(c);p.turn('X',1);p.undo();expect(p.orientation).toEqual(identity());p.toggle(c);p.undo();expect(p.placed).toEqual([c]);p.undo();expect(p.placed).toEqual([]);p.reset();expect(p.history).toEqual([]);
  });
});
describe('Уровни и редактор',()=>{
  for(const l of levels)it(`${l.name} корректен и решаем`,()=>{
    expect(parseLevel(JSON.stringify(l))).toEqual(l);const s=solve(l);expect(s).not.toBeNull();const p=new Puzzle(l);for(const v of s!.placed)expect(p.place(v)).toBe(true);expect(p.orientation).toEqual(l.orientation);expect(p.won).toBe(true);expect(p.level.fixed).toEqual(l.fixed);
  });
  it('средний уровень имеет нетривиальное решение без поворота',()=>{
    const p=new Puzzle(levels[1]);expect(p.won).toBe(false);const s=solve(levels[1])!;expect(s.placed.length).toBeGreaterThan(1);expect(s.orientation).toEqual(levels[1].orientation);
  });
  it('по умолчанию решатель не использует сохранённые механики вращения',()=>{
    const rotated={...levels[1],orientation:rotate(identity(),'X')};expect(solve(rotated)).toBeNull();expect(solve(rotated,true)).not.toBeNull();
  });
  it('отклоняет пересечения, дробные координаты и неверные матрицы',()=>{
    expect(()=>parseLevel(JSON.stringify({...levels[0],available:levels[0].fixed}))).toThrow();
    expect(()=>parseLevel(JSON.stringify({...levels[0],fixed:[[.5,0,0]]}))).toThrow();
    expect(()=>parseLevel(JSON.stringify({...levels[0],targets:[[true],[]]}))).toThrow();
    expect(()=>parseLevel(JSON.stringify({...levels[0],orientation:[[1,0,0],[1,0,0],[0,0,1]]}))).toThrow();
  });
  it('обнаруживает нерешаемый уровень',()=>{expect(solve({...levels[0],limit:0})).toBeNull();});
});
