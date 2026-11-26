import { readdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";
const files = [];
async function walk(path = "dist", prefix = "") {
  for (const item of await readdir(path, { withFileTypes: true })) {
    const relative = prefix + item.name;
    if (item.isDirectory()) await walk(join(path, item.name), relative + "/");
    else if (item.name !== "sw.js") files.push(relative);
  }
}
await walk();
const hash = createHash("sha256");
for (const path of [...files].sort()) {
  hash.update(path);
  hash.update(await readFile(join("dist", path)));
}
const version = hash.digest("hex").slice(0, 16);
const core = files.filter((p) => !p.startsWith("ocr/"));
const ocr = files.filter((p) => p.startsWith("ocr/"));
const worker = `/* Generated from content hashes. All assets are same-origin. */
const PREFIX='btp-next-'+new URL(self.registration.scope).pathname+'-';
const CACHE=PREFIX+${JSON.stringify(version)};
const CORE=${JSON.stringify(core)}, OCR=${JSON.stringify(ocr)};
const absolute=p=>new URL(p,self.registration.scope).href;
async function status(){const c=await caches.open(CACHE);const ready=!!(await c.match(absolute('ocr/lang/eng.traineddata.gz')));return {type:'OFFLINE_READY',ocr:ready};}
self.addEventListener('install',event=>event.waitUntil((async()=>{
  const cache=await caches.open(CACHE);await cache.addAll(CORE.map(absolute));
  // OCR is bundled locally. Failure leaves the inspection UI usable offline.
  try{await cache.addAll(OCR.map(absolute));}catch{console.warn('OCR offline cache incomplete');}
  await self.skipWaiting();
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  for(const key of await caches.keys())if(key.startsWith(PREFIX)&&key!==CACHE)await caches.delete(key);
  await self.clients.claim();const message=await status();for(const client of await self.clients.matchAll())client.postMessage(message);
})()));
self.addEventListener('message',event=>{if(event.data?.type==='STATUS')event.waitUntil((async()=>event.source?.postMessage(await status()))());});
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  if(event.request.method!=='GET'||url.origin!==self.location.origin||!url.href.startsWith(self.registration.scope))return;
  event.respondWith((async()=>{
    const cached=await caches.match(event.request);if(cached)return cached;
    try{return await fetch(event.request);}catch(error){
      if(event.request.mode==='navigate')return await caches.match(absolute('index.html'))||Response.error();
      throw error;
    }
  })());
});
`;
await writeFile("dist/sw.js", worker);
console.log(
  `Offline worker ${version}: ${core.length} app assets + ${ocr.length} OCR assets`,
);
