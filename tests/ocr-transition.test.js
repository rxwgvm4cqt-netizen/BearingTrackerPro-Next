import test from 'node:test';
import assert from 'node:assert/strict';
import { createRpmConfirmation, getOcrSignal, nextOcrDelay, OCR_MAX_AGE_MS } from '../src/utils/ocrRpm.js';
test('confirm changed RPM within two rapid samples without averaging old speed',()=>{
 const f=createRpmConfirmation();
 assert.equal(f.push(9.87,0),null);assert.equal(f.push(9.87,400),9.87);
 assert.equal(f.push(12.34,800),null);assert.equal(f.push(12.34,1200),12.34);
 assert.equal(f.push(12.4,1600),12.4);
});
test('isolated outliers and unreadable frames cannot overwrite confirmed RPM',()=>{
 const f=createRpmConfirmation();f.push(9.87,0);assert.equal(f.push(9.87,400),9.87);
 assert.equal(f.push(29,800),null);assert.equal(f.push(9.87,1200),null);assert.equal(f.push(9.87,1600),9.87);
 assert.equal(f.push(null,2000),null);assert.equal(f.push(12.34,2400),null);assert.equal(f.push(12.34,2800),12.34);
});
test('confirmed zero is valid and is never smoothed into positive motion',()=>{
 const f=createRpmConfirmation();f.push(12,0);f.push(12,400);assert.equal(f.push(0,800),null);assert.equal(f.push(0,1200),0);
 assert.deepEqual(getOcrSignal({value:0,timestamp:1200},1400),{status:'ocrLive',rpm:0});
});
test('short gaps hold measured RPM and long gaps stop integrating without fabricating a new sample',()=>{
 const sample={value:9.87,timestamp:1000};
 assert.equal(getOcrSignal(sample,2000).status,'ocrLive');
 assert.deepEqual(getOcrSignal(sample,3000),{status:'ocrHeld',rpm:9.87});
 assert.deepEqual(getOcrSignal(sample,1001+OCR_MAX_AGE_MS),{status:'ocrLost',rpm:0});
 assert.deepEqual(sample,{value:9.87,timestamp:1000});
 assert.equal(getOcrSignal({value:12.34,timestamp:9000},9100).rpm,12.34);
});
test('invalid inputs, stale confirmation pairs and reversed timestamps are rejected',()=>{
 const f=createRpmConfirmation();f.push(10,0);assert.equal(f.push(10,5000),null);
 assert.equal(f.push(10,4500),null);assert.equal(f.push(31,5500),null);
 assert.equal(getOcrSignal(null,6000).status,'ocrWaiting');
 assert.equal(getOcrSignal({value:NaN,timestamp:0},6000).status,'ocrWaiting');
 assert.equal(getOcrSignal({value:10,timestamp:7000},6000).status,'ocrWaiting');
});
test('completed OCR jobs schedule promptly and leave a render window on slower devices',()=>{
 assert.equal(nextOcrDelay(50),350);assert.equal(nextOcrDelay(390),80);assert.equal(nextOcrDelay(1600),80);
});
