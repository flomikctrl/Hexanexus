import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {rankTrophy} from './trophy';
it('uses five distinct offline vector cups at the unchanged rank boundaries',()=>{const sources=new Set<string>(),files=new Set<string>();for(const [cups,name]of [[0,'Бронза'],[100,'Серебро'],[250,'Золото'],[500,'Платина'],[900,'Алмаз']] as const){const t=rankTrophy(cups);expect(t.name).toBe(name);sources.add(t.src);const svg=readFileSync('public'+t.src,'utf8');expect(svg).toContain('viewBox="0 0 320 250"');expect(svg).not.toMatch(/<script|https:|<image/);files.add(svg);}expect(sources.size).toBe(5);expect(files.size).toBe(5);expect(rankTrophy(99).name).toBe('Бронза');expect(rankTrophy(899).name).toBe('Платина');});
