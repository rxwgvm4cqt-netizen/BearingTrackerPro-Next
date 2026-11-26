import test from 'node:test';
import assert from 'node:assert/strict';
import { beginManualCoast, integrateManualCoast, createSession } from '../src/engine/kinematics.js';
import { defaultPresets } from '../src/data/presets.js';
const setup=(rpm=10,direction='cw')=>({...createSession(defaultPresets),mode:'manual',manualRpm:rpm,direction,outerRunning:true,cageRunning:true});
for (const direction of ['cw','ccw']) test(`manual coast travels 2.5 turns and stops: ${direction}`,()=>{
 let s=beginManualCoast(setup(10,direction));
 const sign=direction==='cw'?1:-1;
 const duration=s.coast.duration;
 assert.equal(duration,30000);
 s=integrateManualCoast(s,duration/2,defaultPresets);
 assert.ok(Math.abs(s.rotorTravel-sign*675)<1e-9);
 s=integrateManualCoast(s,duration,defaultPresets);
 assert.ok(Math.abs(s.rotorTravel-sign*900)<1e-9);
 assert.ok(Math.abs(s.rows[defaultPresets[0].id].travel-sign*900*0.5081)<1e-9);
 assert.equal(s.outerRunning,false); assert.equal(s.cageRunning,false); assert.equal(s.coast,null);
 assert.deepEqual(integrateManualCoast(s,1000,defaultPresets),s);
});
test('repeated stop does not restart the braking distance',()=>{
 const s=integrateManualCoast(beginManualCoast(setup()),1000,defaultPresets);
 assert.equal(beginManualCoast(s),s);
});
test('coast slows each equal time step, independent of frame partition',()=>{
 let s=beginManualCoast(setup(30));const deltas=[];
 for(let i=0;i<10;i++){const before=s.rotorTravel;s=integrateManualCoast(s,1000,defaultPresets);deltas.push(s.rotorTravel-before);}
 assert.ok(deltas.every((d,i)=>!i||d<deltas[i-1]));assert.ok(Math.abs(s.rotorTravel-900)<1e-9);
});
test('zero RPM, inactive manual tracking, finger and OCR never start a coast',()=>{
 for(const state of [setup(0),{...setup(),outerRunning:false,cageRunning:false},{...setup(),mode:'finger'},{...setup(),mode:'ocr'}]) assert.equal(beginManualCoast(state).coast,null);
});
test('generator view reverses canonical motion and partial start keeps stationary parts still',()=>{
 const presets=structuredClone(defaultPresets);presets[0].viewingDirection='generator';
 const start={...setup(),cageRunning:false};const s=integrateManualCoast(beginManualCoast(start),1e9,presets);
 assert.ok(Math.abs(s.rotorTravel+900)<1e-9);assert.equal(s.rows[presets[0].id].travel,0);
});
