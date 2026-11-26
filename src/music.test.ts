import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
it('локальные музыка и победа имеют корректный PCM, запас до клиппинга и мягкий стык',()=>{
 for(const name of ['silhouette-loop','victory']){const b=readFileSync(new URL('../public/audio/'+name+'.wav',import.meta.url));expect(b.toString('ascii',0,4)).toBe('RIFF');expect(b.readUInt32LE(4)).toBe(b.length-8);expect(b.readUInt32LE(24)).toBe(22050);expect(b.readUInt16LE(22)).toBe(2);expect(b.readUInt16LE(34)).toBe(16);const n=(b.length-44)/4,seconds=n/22050;expect(seconds).toBeGreaterThan(name==='victory'?1:60);expect(seconds).toBeLessThan(name==='victory'?2:120);let peak=0,step=0;for(let i=1;i<n;i++){peak=Math.max(peak,Math.abs(b.readInt16LE(44+i*4)));step=Math.max(step,Math.abs(b.readInt16LE(44+i*4)-b.readInt16LE(44+(i-1)*4)));}expect(peak).toBeLessThan(20000);expect(peak).toBeGreaterThan(2000);const seam=Math.abs(b.readInt16LE(44)-b.readInt16LE(44+(n-1)*4));expect(seam).toBeLessThanOrEqual(step*1.05);}
});
