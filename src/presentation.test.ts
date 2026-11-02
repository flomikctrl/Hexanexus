import {describe,it,expect} from 'vitest';
import {cellStyle,cellColors,cellLabels,diagnose} from './presentation';
import {project} from './projections';
import {identity} from './math';
import {Puzzle} from './state';
import {levels} from './levels';
import type {Targets} from './projections';
describe('Единые обозначения силуэтов для UI и 3D',()=>{
  it.each([[true,true,'correct'],[true,false,'missing'],[false,true,'excess'],[false,false,'empty']] as const)('цель %s, факт %s → %s',(target,actual,style)=>{
    expect(cellStyle(target,actual,'training')).toBe(style);expect(cellLabels[style]).toBeTruthy();expect(cellColors[style]).toBeTypeOf('number');
  });
  it('обычный режим не раскрывает фактические кубики',()=>{
    for(const target of [false,true])expect(cellStyle(target,false,'normal')).toBe(cellStyle(target,true,'normal'));
    expect(cellStyle(true,false,'normal')).toBe('goal');expect(cellStyle(false,true,'normal')).toBe('empty');
  });
  it('обозначения соответствуют реальной ортогональной проекции',()=>{
    const target=project([[0,0,0],[1,1,0]],identity());const actual=project([[0,0,0],[-1,-1,0]],identity());
    expect(cellStyle(target[0][4],actual[0][4],'training')).toBe('correct');
    expect(cellStyle(target[0][2],actual[0][2],'training')).toBe('missing');
    expect(cellStyle(target[0][6],actual[0][6],'training')).toBe('excess');
    expect(cellStyle(target[0][0],actual[0][0],'training')).toBe('empty');
  });
});
describe('Диагностика двух проекций',()=>{
  it('считает все 9 клеток, включая правильно пустые, для каждой стороны отдельно',()=>{
    const targets:Targets=[Array(9).fill(false),Array(9).fill(true)];
    const actual:Targets=[Array(9).fill(false),Array(9).fill(false)];actual[0][0]=true;actual[1][8]=true;
    const result=diagnose(targets,actual);expect(result[0].matches).toBe(8);expect(result[1].matches).toBe(1);expect(result[0].styles).toHaveLength(9);expect(result[1].styles).toHaveLength(9);
    expect(diagnose(targets,targets).map(r=>r.matches)).toEqual([9,9]);
  });
  it('обновляется после установки, удаления, отмены и сброса',()=>{
    const p=new Puzzle(levels[0]);const initial=diagnose(p.level.targets,p.projections);expect(p.place([1,0,0])).toBe(true);const placed=diagnose(p.level.targets,p.projections);expect(placed).not.toEqual(initial);
    expect(p.remove([1,0,0])).toBe(true);expect(diagnose(p.level.targets,p.projections)).toEqual(initial);p.undo();expect(diagnose(p.level.targets,p.projections)).toEqual(placed);p.reset();expect(diagnose(p.level.targets,p.projections)).toEqual(initial);
  });
  it('не определяет ошибки по конкретной конфигурации кубиков',()=>{
    const fixed:[number,number,number][]=[[-1,0,0],[1,0,0]];
    const a=project([...fixed,[-1,0,-1],[1,0,1]],identity()),b=project([...fixed,[-1,0,1],[1,0,-1]],identity());
    expect(diagnose(a,a)).toEqual(diagnose(a,b));expect(diagnose(a,b).map(r=>r.matches)).toEqual([9,9]);
  });
});
