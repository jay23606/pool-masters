// Deliberately conservative: this app redeploys on every push to main, and a
// cache-first shell is the classic way to strand players on an old build.
const VERSION='pool-masters-v2'
const SHELL=['./','./manifest.webmanifest','./icon-192.png','./icon-512.png']

self.addEventListener('install',e=>{
 // no skipWaiting: the new worker takes over on the next load, so a running
 // page keeps the caches its own chunks were served from
 e.waitUntil(caches.open(VERSION).then(c=>c.addAll(SHELL)).catch(()=>{}))
})

self.addEventListener('activate',e=>{
 e.waitUntil((async()=>{
  for(const k of await caches.keys())if(k!==VERSION)await caches.delete(k)
  await self.clients.claim()
 })())
})

self.addEventListener('fetch',e=>{
 const req=e.request
 if(req.method!=='GET')return
 const url=new URL(req.url)
 if(url.origin!==location.origin)return           // Supabase and WebRTC go straight out

 // Navigations go to the network first so a deploy is picked up immediately,
 // falling back to the cached shell only when actually offline.
 if(req.mode==='navigate'){
  e.respondWith((async()=>{
   try{
    const res=await fetch(req)
    const c=await caches.open(VERSION);c.put('./',res.clone())
    return res
   }catch{
    return (await caches.match('./'))||Response.error()
   }
  })())
  return
 }

 // Build output is content-hashed, so a hit is always the right file.
 e.respondWith((async()=>{
  const hit=await caches.match(req)
  if(hit)return hit
  const res=await fetch(req)
  if(res.ok&&res.type==='basic'){const c=await caches.open(VERSION);c.put(req,res.clone())}
  return res
 })())
})
