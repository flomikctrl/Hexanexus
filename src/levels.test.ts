import {describe,it,expect} from 'vitest';
import {levels,levelWitnesses} from './levels';
import {validateCampaign} from './level-validation';
import {Puzzle} from './state';
import {project} from './projections';
import {identity,type Vec} from './math';
describe('Кампания из 10 уровней',()=>{
  it('все десять проверяются контрольными ходами и независимым решателем',()=>{expect(validateCampaign()).toHaveLength(10);});
  it('первые три уровня сохраняют исходные данные',()=>{
    const roots:Vec[][]=[[[-1,-1,0],[0,-1,0],[0,0,0]],[[-1,-1,-1],[-1,0,-1],[0,0,0]],[[-1,-1,1],[0,0,0],[1,1,-1]]];
    const answers:Vec[][]=[[[1,0,0],[1,1,0]],[[1,0,0],[1,1,0],[1,0,1]],[[0,1,0],[-1,1,0],[0,1,1],[0,-1,0]]];
    for(let i=0;i<3;i++){expect(levels[i].fixed).toEqual(roots[i]);expect(levels[i].targets).toEqual(project([...roots[i],...answers[i]],identity()));expect(levels[i].limit).toBe([2,3,4][i]);expect(levels[i].available).toHaveLength(27-roots[i].length);expect(levels[i].orientation).toEqual(identity());}
  });
  it('уровень 8 принимает два разных законных решения',()=>{const l=levels[7];const a=levelWitnesses[l.name],b:Vec[]=[[-1,0,1],[1,0,-1],[1,1,0],[0,1,0],[-1,1,0]];expect(a).not.toEqual(b);for(const moves of [a,b]){const p=new Puzzle(l);for(const v of moves)expect(p.place(v)).toBe(true);expect(p.won).toBe(true);}});
  it('уровень 5 требует заполнений сзади и ниже центрального слоя',()=>{expect(levels[4].targets[1][3]).toBe(true);expect(levels[4].targets[1].slice(6).some(Boolean)).toBe(true);});
});
