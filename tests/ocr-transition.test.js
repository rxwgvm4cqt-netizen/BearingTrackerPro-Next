import test from 'node:test';
import assert from 'node:assert/strict';
import { getStableRpmValue, getOcrSignal, OCR_MAX_AGE_MS } from '../src/utils/ocrRpm.js';
test('previous stability rule confirms new values twice and rejects isolated changes',()=>{
 assert.equal(getStableRpmValue([9.87]),null);
 assert.equal(getStableRpmValue([9.87,9.87]),9.87);
 assert.equal(getStableRpmValue([9.87,12.34]),null);
 assert.equal(getStableRpmValue([9.87,12.34,12.34]),12.34);
 assert.equal(getStableRpmValue([9.87,9.87,7]),null);
});
test('confirmed zero remains a real stop value during any reading gap',()=>{
 assert.equal(getStableRpmValue([12,0]),null);
 assert.equal(getStableRpmValue([0,0]),0);
 assert.deepEqual(getOcrSignal({value:0,timestamp:1000},100000),{status:'ocrLost',rpm:0});
});
test('short and prolonged gaps hold only the last measured RPM without refreshing its timestamp',()=>{
 const sample={value:9.87,timestamp:1000};
 assert.equal(getOcrSignal(sample,2500).status,'ocrLive');
 assert.deepEqual(getOcrSignal(sample,5500),{status:'ocrHeld',rpm:9.87});
 assert.deepEqual(getOcrSignal(sample,1001+OCR_MAX_AGE_MS),{status:'ocrLost',rpm:9.87});
 assert.deepEqual(getOcrSignal(sample,100000),{status:'ocrLost',rpm:9.87});
 assert.deepEqual(sample,{value:9.87,timestamp:1000});
 assert.equal(getOcrSignal({value:12.34,timestamp:9000},9100).rpm,12.34);
});
test('missing, invalid or future samples never invent an RPM value',()=>{
 for(const sample of [null,{value:NaN,timestamp:0},{value:31,timestamp:0},{value:10,timestamp:7000}])
  assert.deepEqual(getOcrSignal(sample,6000),{status:'ocrWaiting',rpm:0});
});
