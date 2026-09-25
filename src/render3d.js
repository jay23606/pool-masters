import {W,H,R,PR,POCKETS,COLORS} from './table.js'
import {rayToRail} from './pool.js'
import {tableFractions} from './screen-point.js'

// WebGL renderer. Purely a view over the existing 2D simulation: it reads the
// same {x,y,vx,vy,on,k,n} balls the 2D renderer does and never writes to them,
// so physics and the network protocol are untouched.
const CLOTH='#15794a',CUSHION='#0f6038',WOOD='#472616',WOOD_DARK='#2c180e'
const MOODS={hall:{bg:'#07110d',key:'#fff3dc',rim:'#9fd8ff'},warm:{bg:'#1a100c',key:'#ffe0a8',rim:'#d99b62'},cool:{bg:'#07131d',key:'#d9ebff',rim:'#70b9ff'}}
const CUES={classic:{shaft:'#e6d6ab',butt:'#4a2a18',tip:'#4e8fa6'},ebony:{shaft:'#d8c49e',butt:'#171414',tip:'#d9b35d'},midnight:{shaft:'#c7d0d7',butt:'#102b52',tip:'#71c4e9'}}
const tx=x=>x-W/2, tz=y=>y-H/2   // table coords -> world (y is up)

// Bake a pool-ball skin into a sphere-UV texture, once per ball.
// The two number discs sit on the UV poles, so the digits are pre-warped into
// polar coordinates to come out round and upright on the sphere.
function ballTexture(THREE,kind,n){
 const TW=512,TH=256,cap=.085,c=document.createElement('canvas');c.width=TW;c.height=TH
 const g=c.getContext('2d'),white='#f7f4e9',col=COLORS[n]
 if(kind==='cue'){g.fillStyle='#f2efe4';g.fillRect(0,0,TW,TH);g.fillStyle='#b83232';for(const[u,v]of[[.25,.5],[.75,.5],[.5,.28],[.0,.72]]){g.beginPath();g.arc(u*TW,v*TH,9,0,7);g.fill()}}
 else{
  g.fillStyle=white;g.fillRect(0,0,TW,TH)
  // solids are colour everywhere but the poles; stripes keep a white band top and bottom
  g.fillStyle=col
  if(kind==='stripe')g.fillRect(0,TH*.39,TW,TH*.22)
  else g.fillRect(0,TH*cap,TW,TH*(1-2*cap))
  // number discs, pre-warped into the two polar caps
  const nc=document.createElement('canvas');nc.width=nc.height=128
  const ng=nc.getContext('2d')
  ng.fillStyle=white;ng.beginPath();ng.arc(64,64,64,0,7);ng.fill()
  ng.fillStyle='#14190f';ng.font='bold 66px Arial, sans-serif';ng.textAlign='center';ng.textBaseline='middle';ng.fillText(String(n),64,68)
  const src=ng.getImageData(0,0,128,128).data,capRows=Math.round(TH*cap),img=g.getImageData(0,0,TW,TH),dst=img.data
  for(let j=0;j<capRows;j++)for(const top of[true,false]){
   const row=top?j:TH-1-j, r=(j+.5)/capRows
   for(let i=0;i<TW;i++){
    const a=(i/TW)*Math.PI*2*(top?1:-1),sx=Math.round(64+Math.cos(a)*r*63),sy=Math.round(64+Math.sin(a)*r*63)
    if(sx<0||sy<0||sx>127||sy>127)continue
    const s=(sy*128+sx)*4,d=(row*TW+i)*4
    if(src[s+3]<8)continue
    dst[d]=src[s];dst[d+1]=src[s+1];dst[d+2]=src[s+2];dst[d+3]=255
   }
  }
  g.putImageData(img,0,0)
 }
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;return t
}

// The UV number discs look natural from an angled camera but collapse into a
// highlight in the top view. A small static cap keeps each ball identifiable
// without bringing back the distracting full-ball spin animation.
function numberCap(THREE,n,kind){
 const c=document.createElement('canvas');c.width=c.height=96
 const g=c.getContext('2d');g.clearRect(0,0,96,96)
 // In the top camera a physical stripe lies near the ball's silhouette.
 // Draw its face explicitly: a broad white field with a colour belt makes
 // striped balls recognizable even at phone scale.
 if(kind==='stripe'){
  g.fillStyle='#f7f4e9';g.beginPath();g.arc(48,48,42,0,Math.PI*2);g.fill()
  g.save();g.beginPath();g.arc(48,48,42,0,Math.PI*2);g.clip()
  g.fillStyle=COLORS[n];g.fillRect(4,39,88,18);g.restore()
 }
 g.fillStyle='#f7f4e9';g.beginPath();g.arc(48,48,kind==='stripe'?20:34,0,Math.PI*2);g.fill()
 g.strokeStyle='#152018';g.lineWidth=3;g.stroke()
 g.fillStyle='#111';g.font='bold 44px Arial';g.textAlign='center';g.textBaseline='middle';g.fillText(String(n),48,51)
 const map=new THREE.CanvasTexture(c);map.colorSpace=THREE.SRGBColorSpace
 // A stripe has to cover the visible top of the sphere. The old number-sized
 // decal left the coloured sphere exposed around it, so a 12 or 14 looked like
 // a solid despite its correct game data.
 const size=kind==='stripe'?R*2.03:R*1.18
 // This is a visual identifier, not a physical object. It must render above
 // the shaded sphere; with depth testing on, the sphere hid almost all of the
 // white stripe face at some camera positions and made stripes read as solids.
 return new THREE.Mesh(new THREE.PlaneGeometry(size,size),new THREE.MeshBasicMaterial({map,transparent:true,depthWrite:false,depthTest:false}))
}

export async function createRenderer3D(canvas,camera3d='top',options={}){
 const THREE=await import('three')
 const {RoomEnvironment}=await import('three/examples/jsm/environments/RoomEnvironment.js')

 const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'})
 renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.75))
 renderer.shadowMap.enabled=true
 renderer.shadowMap.type=THREE.PCFSoftShadowMap
 renderer.toneMapping=THREE.ACESFilmicToneMapping
 renderer.toneMappingExposure=.92

 const scene=new THREE.Scene(),mood=MOODS[options.lighting]||MOODS.hall,cueStyle=CUES[options.cue]||CUES.classic
 scene.background=new THREE.Color(mood.bg)
 const pmrem=new THREE.PMREMGenerator(renderer)
 scene.environment=pmrem.fromScene(new RoomEnvironment(),.04).texture
 scene.environmentIntensity=.22

 const camera=new THREE.PerspectiveCamera(40,W/H,10,4000)
 const TARGET=new THREE.Vector3(0,0,4)
 // Two camera placements over one scene. Top-down keeps the plan view the
 // 2D renderer gives — same orientation, so aiming intuition carries over —
 // while still being lit, shaded and rounded. Its up vector points along -z
 // so table y runs down the screen exactly as it does in 2D, and it uses a
 // narrower lens to keep the perspective from bowing the rails outward.
 const CAMS={
  top:{dir:new THREE.Vector3(0,1,0),up:new THREE.Vector3(0,0,-1),fov:26},
  angled:{dir:new THREE.Vector3(0,.9,.55).normalize(),up:new THREE.Vector3(0,1,0),fov:40}
 }
 let cam=CAMS[camera3d]||CAMS.top

 scene.add(new THREE.HemisphereLight('#cfe9dc','#0e2218',.16))
 // a pool-hall pendant: one shadow-casting spot straight over the table
 // inverse-square falloff so the cloth is brightest at centre and rolls off
 // toward the cushions, the way a low pendant over a table actually reads
 const key=new THREE.SpotLight(mood.key,1.9e6,1600,.8,.55,2)
 // deliberately off-axis: a light straight overhead hides every ball's shadow
 // underneath it, which reads as flat from this camera
 key.position.set(-300,430,-150);key.target.position.set(20,0,40);key.castShadow=true
 key.shadow.mapSize.set(1024,1024)
 key.shadow.camera.near=120;key.shadow.camera.far=900
 key.shadow.bias=-.0009;key.shadow.normalBias=.9;key.shadow.focus=1
 scene.add(key,key.target)
 const rim=new THREE.DirectionalLight(mood.rim,.28);rim.position.set(360,260,-300);scene.add(rim)
 const front=new THREE.DirectionalLight('#ffe9c4',.18);front.position.set(-220,380,420);scene.add(front)

 const std=(color,roughness,metalness=0)=>new THREE.MeshStandardMaterial({color,roughness,metalness})
 const box=(w,h,d,mat,x,y,z)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);scene.add(m);return m}

 // ---- table ----
 // one small noise tile as a bump map: the cloth stops reading as flat vinyl
 // for the cost of a 128px texture generated once
 const noise=document.createElement('canvas');noise.width=noise.height=128
 {const ng=noise.getContext('2d'),img=ng.createImageData(128,128)
  for(let i=0;i<128*128;i++){const v=200+Math.random()*55;img.data[i*4]=img.data[i*4+1]=img.data[i*4+2]=v;img.data[i*4+3]=255}
  ng.putImageData(img,0,0)}
 const clothBump=new THREE.CanvasTexture(noise)
 clothBump.wrapS=clothBump.wrapT=THREE.RepeatWrapping;clothBump.repeat.set(70,38)
 const clothMat=new THREE.MeshStandardMaterial({color:options.felt||CLOTH,roughness:.99,bumpMap:clothBump,bumpScale:1.5})
 const cushionMat=std(CUSHION,.95),woodMat=std(WOOD,.45),apronMat=std(WOOD_DARK,.6)
 const cloth=box(W,6,H,clothMat,0,-3,0);cloth.receiveShadow=true
 box(768,36,448,apronMat,0,-24,0)
 for(const[w,d,x,z]of[[768,34,0,-207],[768,34,0,207],[34,380,-367,0],[34,380,367,0]]){const m=box(w,18,d,woodMat,x,9,z);m.castShadow=true;m.receiveShadow=true}
 // cushions, in table coords, with gaps left at the six pockets
 for(const[x0,x1,y0,y1]of[[47,331,18,28],[369,653,18,28],[47,331,352,362],[369,653,352,362],[18,28,47,333],[672,682,47,333]]){
  const m=box(x1-x0,13,y1-y0,cushionMat,tx((x0+x1)/2),6.5,tz((y0+y1)/2));m.castShadow=true;m.receiveShadow=true
 }
 const pocketMat=std('#05100b',.9)
 const pocketGeo=new THREE.CylinderGeometry(PR-1.5,PR-3,7,28)
 POCKETS.forEach(([x,y])=>{const m=new THREE.Mesh(pocketGeo,pocketMat);m.position.set(tx(x),-1,tz(y));scene.add(m)})
 const ring=new THREE.Mesh(new THREE.TorusGeometry(PR+3,1.7,8,36),new THREE.MeshBasicMaterial({color:'#ffd75d'}))
 ring.rotation.x=-Math.PI/2;ring.position.y=1.6;ring.visible=false;scene.add(ring)

 // ---- balls ----
 const ballGeo=new THREE.SphereGeometry(R,40,28)
 const balls=[]   // one entry per ball index, created lazily to match game.balls
 function ballFor(i,b){
  // A new rack shuffles ball numbers while preserving their array positions.
  // Reusing a mesh solely by index left the new physics state displaying the
  // previous rack's number and group in that same slot.
  if(balls[i]&&balls[i].n===b.n&&balls[i].k===b.k)return balls[i]
  if(balls[i]){
   const old=balls[i]
   for(const part of [old.mesh,old.stripe,old.badge])if(part){scene.remove(part);if(part!==old.mesh)part.geometry?.dispose?.();const m=part.material;if(m)(Array.isArray(m)?m:[m]).forEach(x=>{x.map?.dispose?.();x.dispose?.()})}
  }
 // A 9 shares yellow with the 1, and a 14 shares green with the 6. Keep the
 // stripe sphere white so category identity never depends on a tiny number or
 // a texture orientation.
 const mat=new THREE.MeshStandardMaterial({map:b.k==='stripe'?null:ballTexture(THREE,b.k,b.n),color:b.k==='stripe'?'#f7f4e9':'#ffffff',roughness:.13,metalness:0,envMapIntensity:1.4})
 const mesh=new THREE.Mesh(ballGeo,mat);mesh.castShadow=true;mesh.position.set(tx(b.x),R,tz(b.y))
  // A fixed coloured ring on the white stripe base reads from both the top
  // and angled views, without the distracting continuous spin animation.
  let stripe=null
  if(b.k==='stripe'){
   stripe=new THREE.Mesh(new THREE.TorusGeometry(R*.58,R*.17,10,32),std(COLORS[b.n],.32))
   stripe.rotation.x=Math.PI/2;stripe.position.set(tx(b.x),R+.16,tz(b.y));stripe.castShadow=true;scene.add(stripe)
  }
  let badge=null
  if(b.k!=='cue'){
   badge=numberCap(THREE,b.n,b.k);badge.rotation.x=-Math.PI/2;badge.position.set(tx(b.x),R+1,tz(b.y));badge.renderOrder=10;scene.add(badge)
  }
  mesh.rotation.set(Math.random()*6,Math.random()*6,Math.random()*6)
  scene.add(mesh)
  return balls[i]={mesh,mat,stripe,badge,n:b.n,k:b.k,shown:{x:b.x,y:b.y},sink:0}
 }

 // ---- aim overlays ----
 const lineMat=(color,opacity)=>new THREE.LineBasicMaterial({color,transparent:true,opacity,depthTest:false})
 const makeLine=(mat,pts)=>{const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(pts*3),3));const l=new THREE.Line(g,mat);l.frustumCulled=false;l.renderOrder=5;scene.add(l);return l}
 const aimLine=makeLine(lineMat('#ffffff',.9),2),cutLine=makeLine(lineMat('#ffd96a',.9),2),bankLine=makeLine(lineMat('#ffffff',.4),3)
 function setLine(line,pts){const a=line.geometry.attributes.position;pts.forEach((p,i)=>a.setXYZ(i,tx(p.x),1.4,tz(p.y)));a.needsUpdate=true;line.geometry.setDrawRange(0,pts.length);line.visible=pts.length>1}
 const ghost=new THREE.Mesh(ballGeo,new THREE.MeshBasicMaterial({color:'#ffffff',transparent:true,opacity:.22,depthWrite:false}))
 ghost.renderOrder=4;ghost.visible=false;scene.add(ghost)

 const cue=new THREE.Group()
 {const shaft=new THREE.Mesh(new THREE.CylinderGeometry(2.6,4.4,200,18),std(cueStyle.shaft,.5))
  const butt=new THREE.Mesh(new THREE.CylinderGeometry(4.4,5.6,140,18),std(cueStyle.butt,.35))
  const tip=new THREE.Mesh(new THREE.CylinderGeometry(2.5,2.6,5,16),std(cueStyle.tip,.7))
  shaft.rotation.z=butt.rotation.z=tip.rotation.z=Math.PI/2
  tip.position.x=2.5;shaft.position.x=-100;butt.position.x=-270
  ;[shaft,butt,tip].forEach(m=>{m.castShadow=true;cue.add(m)})
 }
 cue.visible=false;scene.add(cue)

 // ---- framing ----
 const CORNERS=[]
 for(const x of[-374,374])for(const z of[-213,213])for(const y of[0,18])CORNERS.push(new THREE.Vector3(x,y,z))
 function frame(){
  let dist=900
  camera.up.copy(cam.up);camera.fov=cam.fov
  for(let pass=0;pass<6;pass++){
   camera.position.copy(cam.dir).multiplyScalar(dist).add(TARGET)
   camera.lookAt(TARGET);camera.updateMatrixWorld();camera.updateProjectionMatrix()
   let worst=0
   for(const c of CORNERS){const p=c.clone().project(camera);worst=Math.max(worst,Math.abs(p.x),Math.abs(p.y))}
   if(Math.abs(worst-.985)<.01)break
   dist*=worst/.985
  }
  key.target.updateMatrixWorld()
 }

 function resize(){
  const wrap=canvas.parentElement,cw=Math.max(240,wrap?.clientWidth||W),ch=cw*H/W
  renderer.setSize(cw,ch,false)
  camera.aspect=cw/ch;frame()
 }
 const ro=new ResizeObserver(resize);if(canvas.parentElement)ro.observe(canvas.parentElement)
 resize()

 const plane=new THREE.Plane(new THREE.Vector3(0,1,0),-R),ray=new THREE.Raycaster(),ndc=new THREE.Vector2(),hitPt=new THREE.Vector3()
 const axis=new THREE.Vector3(),spin=new THREE.Quaternion()

 return {
  mode:'3d',
  el:canvas,
  resize,
  // swapping between the two 3D cameras must not rebuild the scene: the ball
  // textures are baked once and are by far the most expensive thing here
  setCamera(m){cam=CAMS[m]||CAMS.top;frame()},
  setFelt(color){clothMat.color.set(color)},
  point(e){
   const {fx,fy}=tableFractions(canvas,e)
   ndc.set(fx*2-1,-(fy*2-1))
   ray.setFromCamera(ndc,camera)
   if(!ray.ray.intersectPlane(plane,hitPt))return null
   return{x:hitPt.x+W/2,y:hitPt.z+H/2}
  },
  draw(game,dt){
   const k=1-Math.exp(-Math.min(dt,.05)*34)
   game.balls.forEach((b,i)=>{
    const e=ballFor(i,b),s=e.shown
    // ease toward the simulated position: host state arrives rounded to whole
    // units, which is invisible top-down but reads as jitter up close
    const dx=b.x-s.x,dy=b.y-s.y
    if(Math.hypot(dx,dy)>45){s.x=b.x;s.y=b.y}else{s.x+=dx*k;s.y+=dy*k}
    const mx=tx(s.x),mz=tz(s.y),moved=Math.hypot(mx-e.mesh.position.x,mz-e.mesh.position.z)
    if(moved>.0005&&e.sink===0){
     axis.set(mz-e.mesh.position.z,0,-(mx-e.mesh.position.x)).normalize()
     spin.setFromAxisAngle(axis,moved/R);e.mesh.quaternion.premultiply(spin)
    }
    e.mesh.position.x=mx;e.mesh.position.z=mz
    if(e.stripe){e.stripe.position.x=mx;e.stripe.position.z=mz}
    if(e.badge){e.badge.position.x=mx;e.badge.position.z=mz}
    if(b.on){e.sink=0;e.mesh.position.y=R;e.mesh.scale.setScalar(1);e.mesh.visible=true;if(e.stripe){e.stripe.position.y=R+.16;e.stripe.scale.setScalar(1);e.stripe.visible=true}if(e.badge){e.badge.position.y=R+.24;e.badge.scale.setScalar(1);e.badge.visible=true}}
    else{e.sink=Math.min(1,e.sink+dt*4);e.mesh.position.y=R-e.sink*34;e.mesh.scale.setScalar(1-e.sink*.35);e.mesh.visible=e.sink<1;if(e.stripe){e.stripe.position.y=R-e.sink*34+.16;e.stripe.scale.setScalar(1-e.sink*.35);e.stripe.visible=e.sink<1}if(e.badge){e.badge.position.y=R-e.sink*34+.24;e.badge.scale.setScalar(1-e.sink*.35);e.badge.visible=e.sink<1}}
   })
   // Meshes are cached by ball index. A ten-ball rack drawn after a sixteen-ball
   // one leaves six meshes with no ball behind them, frozen where they were.
   for(let i=game.balls.length;i<balls.length;i++){
    const e=balls[i];if(!e)continue
    e.mesh.visible=false;if(e.stripe)e.stripe.visible=false;if(e.badge)e.badge.visible=false
   }
   ring.visible=game.calledPocket!=null
   if(ring.visible){const[px,py]=POCKETS[game.calledPocket];ring.position.x=tx(px);ring.position.z=tz(py)}

   const aiming=game.aiming&&game.canAim()
   cue.visible=ghost.visible=aiming
   if(!aiming){aimLine.visible=cutLine.visible=bankLine.visible=false}
   else{
    const q=game.guide(),c=balls[0]?.shown||q.c
    const end={x:c.x+q.dx*q.t,y:c.y+q.dy*q.t}
    setLine(aimLine,[c,end])
    if(q.hit){
     const nx=(q.hit.x-end.x)/(2*R),ny=(q.hit.y-end.y)/(2*R),d=rayToRail(q.hit.x,q.hit.y,nx,ny)
     setLine(cutLine,[q.hit,{x:q.hit.x+nx*d,y:q.hit.y+ny*d}])
     ghost.position.set(tx(end.x),R,tz(end.y));ghost.visible=true
    }else{cutLine.visible=false;ghost.visible=false}
    setLine(bankLine,q.banks.length?[end,...q.banks]:[])
    const pull=R+10+(+game.power.value/100)*46
    cue.position.set(tx(c.x)-q.dx*pull,R+7,tz(c.y)-q.dy*pull)
    cue.rotation.set(0,-Math.atan2(q.dy,q.dx),0)
    cue.rotateZ(-.07)   // pivot about the tip so the butt lifts, not the tip
   }
   renderer.render(scene,camera)
  },
  destroy(){
   ro.disconnect()
   scene.traverse(o=>{o.geometry?.dispose?.();const m=o.material;if(m)(Array.isArray(m)?m:[m]).forEach(x=>{x.map?.dispose?.();x.dispose?.()})})
   pmrem.dispose();renderer.dispose()
  }
 }
}
