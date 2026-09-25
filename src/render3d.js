import {W,H,R,PR,POCKETS,COLORS} from './table.js'
import {rayToRail,bankPath} from './pool.js'
import {tableFractions} from './screen-point.js'
import {CUE_STYLES,RAIL_STYLES} from './cosmetics.js'
import {shotPose,stepBlend,smooth,FOV as SHOT_FOV,MIN_SPEED} from './shot-cam.js'

// WebGL renderer. Purely a view over the existing 2D simulation: it reads the
// same {x,y,vx,vy,on,k,n} balls the 2D renderer does and never writes to them,
// so physics and the network protocol are untouched.
const CLOTH='#15794a',CUSHION='#0f6038',WOOD_DARK='#2c180e'
const MOODS={hall:{bg:'#07110d',key:'#fff3dc',rim:'#9fd8ff'},warm:{bg:'#1a100c',key:'#ffe0a8',rim:'#d99b62'},cool:{bg:'#07131d',key:'#d9ebff',rim:'#70b9ff'}}
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
 const {RoundedBoxGeometry}=await import('three/examples/jsm/geometries/RoundedBoxGeometry.js')

 const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'})
 renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.75))
 renderer.shadowMap.enabled=true
 renderer.shadowMap.type=THREE.PCFSoftShadowMap
 renderer.toneMapping=THREE.ACESFilmicToneMapping
 renderer.toneMappingExposure=.92

 const scene=new THREE.Scene(),mood=MOODS[options.lighting]||MOODS.hall,cueStyle=CUE_STYLES[options.cue]||CUE_STYLES.classic
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
 const feltCanvas=document.createElement('canvas');feltCanvas.width=feltCanvas.height=256
 {const fg=feltCanvas.getContext('2d');fg.fillStyle='#e9e9e9';fg.fillRect(0,0,256,256)
  // fibres: short random strokes in both directions read as woven baize up close
  for(let i=0;i<5200;i++){const v=170+Math.random()*85;fg.strokeStyle=`rgba(${v},${v},${v},.35)`;fg.lineWidth=.6+Math.random()*.7;const x=Math.random()*256,y=Math.random()*256,l=2+Math.random()*5;fg.beginPath();fg.moveTo(x,y);if(Math.random()<.5)fg.lineTo(x+l,y+(Math.random()-.5)*2);else fg.lineTo(x+(Math.random()-.5)*2,y+l);fg.stroke()}}
 const feltMap=new THREE.CanvasTexture(feltCanvas);feltMap.colorSpace=THREE.SRGBColorSpace;feltMap.wrapS=feltMap.wrapT=THREE.RepeatWrapping;feltMap.repeat.set(20,11);feltMap.anisotropy=8
 const clothMat=new THREE.MeshStandardMaterial({color:options.felt||CLOTH,map:feltMap,roughness:.98,bumpMap:clothBump,bumpScale:1.5})
 const tex=(c,rx=1,ry=1)=>{const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(rx,ry);t.anisotropy=8;return t}
 // wavy, slightly varied lines along the long side: enough grain to read as varnished wood
 const woodCanvas=(w,h,base,dark,light)=>{
  const c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d');g.fillStyle=base;g.fillRect(0,0,w,h)
  for(let i=0;i<h*2.2;i++){
   const y=Math.random()*h,amp=.5+Math.random()*2.4,ph=Math.random()*6,fr=.003+Math.random()*.008
   g.strokeStyle=Math.random()<.62?dark:light;g.globalAlpha=.05+Math.random()*.16;g.lineWidth=.5+Math.random()*1.3
   g.beginPath();for(let x=0;x<=w;x+=12){const yy=y+Math.sin(x*fr+ph)*amp;if(x)g.lineTo(x,yy);else g.moveTo(x,yy)}g.stroke()
  }
  g.globalAlpha=1;return c
 }
 // cushions are the felt, a shade darker, whatever the felt is
 const cushionMat=std(CUSHION,.93);cushionMat.color.set(options.felt||CLOTH).multiplyScalar(.74)
 const rails=RAIL_STYLES[options.rails]||RAIL_STYLES.walnut
 const woodMat=new THREE.MeshPhysicalMaterial({map:tex(woodCanvas(1024,48,rails.base,rails.dark,rails.light)),roughness:.42,clearcoat:.55,clearcoatRoughness:.28})
 const apronMat=std(WOOD_DARK,.6)
 const cloth=box(W,6,H,clothMat,0,-3,0);cloth.receiveShadow=true
 box(768,36,448,apronMat,0,-24,0)
 // rails with softened edges; the two short ones are the long one turned
 for(const[w,d,x,z,turn]of[[768,34,0,-207,0],[768,34,0,207,0],[380,34,-367,0,1],[380,34,367,0,1]]){
  const m=new THREE.Mesh(new RoundedBoxGeometry(w,18,d,3,5),woodMat);m.position.set(x,9,z);if(turn)m.rotation.y=Math.PI/2;m.castShadow=true;m.receiveShadow=true;scene.add(m)
 }
 // A cushion is a wedge: tall at the rail, sloping down to a nose at the playing
 // surface. Its ends are cut back toward the nose so the pocket has jaws.
 // Built with its back at depth 0 and its nose at depth 28; the caller turns it into place.
 function cushionGeo(len,jaw){
  const sh=new THREE.Shape();sh.moveTo(0,0);sh.lineTo(0,16);sh.lineTo(23,11.5);sh.lineTo(28,8);sh.lineTo(28,0);sh.closePath()
  const g=new THREE.ExtrudeGeometry(sh,{depth:len,bevelEnabled:false});g.translate(0,0,-len/2)
  const p=g.attributes.position
  for(let i=0;i<p.count;i++){const d=p.getX(i)/28,z=p.getZ(i);p.setZ(i,z-Math.sign(z)*d*jaw)}
  g.computeVertexNormals();return g
 }
 const M0=POCKETS[0][0],MID=POCKETS[1][0],END=POCKETS[2][0],REACH=19
 const along=(a,b)=>[(a+b)/2,b-a]
 // [start, end] of the nose on each side, in table coordinates, with the jaw taper on top
 const JAW=12
 for(const[a,b,side]of[[M0+REACH,MID-REACH,'top'],[MID+REACH,END-REACH,'top'],[M0+REACH,MID-REACH,'bottom'],[MID+REACH,END-REACH,'bottom'],[M0+REACH,H-M0-REACH,'left'],[M0+REACH,H-M0-REACH,'right']]){
  const [c,len]=along(a,b),m=new THREE.Mesh(cushionGeo(len+2*JAW,JAW),cushionMat);m.castShadow=true;m.receiveShadow=true
  if(side==='top'){m.rotation.y=-Math.PI/2;m.position.set(tx(c),0,-H/2)}
  else if(side==='bottom'){m.rotation.y=Math.PI/2;m.position.set(tx(c),0,H/2)}
  else if(side==='left'){m.position.set(-W/2,0,tz(c))}
  else{m.rotation.y=Math.PI;m.position.set(W/2,0,tz(c))}
  scene.add(m)
 }
 // sights: the mother-of-pearl diamonds that let a player measure a bank
 const pearl=new THREE.MeshStandardMaterial({color:'#efe6cf',roughness:.22,metalness:.3})
 const diamondGeo=new THREE.CylinderGeometry(3.4,3.4,.8,4);diamondGeo.scale(.72,1,1.25)
 const diamond=(x,z,turn)=>{const m=new THREE.Mesh(diamondGeo,pearl);m.position.set(x,18.2,z);if(turn)m.rotation.y=Math.PI/2;scene.add(m)}
 for(const k of[1,2,3])for(const zz of[-207,207]){
  const a=M0+(MID-M0)*k/4
  diamond(tx(a),zz,false);diamond(tx(W-a),zz,false)
 }
 for(const k of[1,2,3])for(const xx of[-367,367])diamond(xx,tz(M0+(H-2*M0)*k/4),true)
 // Corner caps: one rounded block over each place two rails meet, so the joint is
 // hidden and the frame reads as one piece, topped with an engraved brass plate.
 const brass=new THREE.MeshStandardMaterial({color:'#c9a24d',roughness:.3,metalness:.85})
 const plateArt=document.createElement('canvas');plateArt.width=plateArt.height=256
 {const g=plateArt.getContext('2d');g.translate(128,128);g.strokeStyle='#3a2508';g.fillStyle='#3a2508';g.lineCap='round'
  g.lineWidth=5;g.strokeRect(-112,-112,224,224);g.lineWidth=2.5;g.strokeRect(-102,-102,204,204)
  g.lineWidth=5
  for(let k=0;k<4;k++){g.save();g.rotate(k*Math.PI/2)
   g.beginPath();g.ellipse(0,-52,20,44,0,0,7);g.stroke()                    // petal
   g.beginPath();g.arc(0,-100,6,0,7);g.fill()                                // bead at its tip
   g.beginPath();g.moveTo(52,-52);g.bezierCurveTo(88,-52,88,-88,66,-88);g.bezierCurveTo(52,-88,52,-72,64,-72);g.stroke() // scroll in the corner
   g.restore()}
  g.beginPath();g.arc(0,0,22,0,7);g.stroke();g.beginPath();g.arc(0,0,8,0,7);g.fill()}
 const plateMat=new THREE.MeshStandardMaterial({map:new THREE.CanvasTexture(plateArt),transparent:true,roughness:.5,metalness:.4,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2})
 plateMat.map.colorSpace=THREE.SRGBColorSpace;plateMat.map.anisotropy=8
 const plateGeo=new THREE.PlaneGeometry(35,35),rivetGeo=new THREE.SphereGeometry(1.5,10,8)
 const capWood=new RoundedBoxGeometry(46,18,46,3,7),plateBase=new RoundedBoxGeometry(38,2.6,38,3,5)
 for(const sx of[-1,1])for(const sz of[-1,1]){
  const x=sx*361,z=sz*201
  const cap=new THREE.Mesh(capWood,woodMat);cap.position.set(x,9,z);cap.castShadow=true;cap.receiveShadow=true;scene.add(cap)
  const base=new THREE.Mesh(plateBase,brass);base.position.set(x,18.4,z);base.castShadow=true;scene.add(base)
  const art=new THREE.Mesh(plateGeo,plateMat);art.rotation.x=-Math.PI/2;art.position.set(x,19.75,z);art.renderOrder=2;scene.add(art)
  for(const[a,b]of[[-15,-15],[15,-15],[-15,15],[15,15]]){const r=new THREE.Mesh(rivetGeo,brass);r.position.set(x+a,19.7,z+b);scene.add(r)}
 }
 // fine brass inlay lines down each rail, either side of the diamonds
 const inlay=(w,d,x,z)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(w,.5,d),brass);m.position.set(x,18.1,z);scene.add(m)}
 for(const zz of[-207,207])for(const off of[-10,10])inlay(662,1.1,0,zz+off)
 for(const xx of[-367,367])for(const off of[-10,10])inlay(1.1,326,xx+off,0)
 // the marks on the cloth: head string, and the head, centre and foot spots
 const marks=document.createElement('canvas');marks.width=W*2;marks.height=H*2
 {const mg=marks.getContext('2d');mg.scale(2,2);mg.strokeStyle='rgba(255,255,255,.16)';mg.fillStyle='rgba(255,255,255,.26)';mg.lineWidth=1
  mg.beginPath();mg.moveTo(175,M0+4);mg.lineTo(175,H-M0-4);mg.stroke()
  for(const x of[175,350,420]){mg.beginPath();mg.arc(x,190,2.4,0,7);mg.fill()}}
 const markTex=new THREE.CanvasTexture(marks);markTex.colorSpace=THREE.SRGBColorSpace
 const markPlane=new THREE.Mesh(new THREE.PlaneGeometry(W,H),new THREE.MeshBasicMaterial({map:markTex,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2}))
 markPlane.rotation.x=-Math.PI/2;markPlane.position.y=.08;markPlane.renderOrder=1;scene.add(markPlane)
 const pocketMat=std('#05100b',.9)
 const pocketGeo=new THREE.CylinderGeometry(PR-1.5,PR-3,7,28)
 POCKETS.forEach(([x,y])=>{const m=new THREE.Mesh(pocketGeo,pocketMat);m.position.set(tx(x),-1,tz(y));scene.add(m)})
 const leather=new THREE.MeshStandardMaterial({color:'#3a2214',roughness:.62})
 const rimGeo=new THREE.TorusGeometry(PR-.5,2.1,10,32)
 POCKETS.forEach(([x,y])=>{const r=new THREE.Mesh(rimGeo,leather);r.rotation.x=Math.PI/2;r.position.set(tx(x),7,tz(y));r.castShadow=true;scene.add(r)})
 const ring=new THREE.Mesh(new THREE.TorusGeometry(PR+3,1.7,8,36),new THREE.MeshBasicMaterial({color:'#ffd75d'}))
 ring.rotation.x=-Math.PI/2;ring.position.y=1.6;ring.visible=false;scene.add(ring)
 // a softer white ring for the pocket the aim has snapped to
 const snapRing=new THREE.Mesh(new THREE.TorusGeometry(PR+1,1.1,8,36),new THREE.MeshBasicMaterial({color:'#ffffff',transparent:true,opacity:.7}))
 snapRing.rotation.x=-Math.PI/2;snapRing.position.y=1.7;snapRing.visible=false;scene.add(snapRing)

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
 const skin=ballTexture(THREE,b.k,b.n)
 const mat=new THREE.MeshStandardMaterial({map:b.k==='stripe'?blank:skin,color:b.k==='stripe'?'#f7f4e9':'#ffffff',roughness:.13,metalness:0,envMapIntensity:1.4})
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
  return balls[i]={mesh,mat,skin,stripe,badge,n:b.n,k:b.k,shown:{x:b.x,y:b.y},sink:0}
 }

 // ---- aim overlays ----
 const lineMat=(color,opacity)=>new THREE.LineBasicMaterial({color,transparent:true,opacity,depthTest:false})
 const makeLine=(mat,pts)=>{const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(pts*3),3));const l=new THREE.Line(g,mat);l.frustumCulled=false;l.renderOrder=5;scene.add(l);return l}
 const aimLine=makeLine(lineMat('#ffffff',.9),2),cutLine=makeLine(lineMat('#ffd96a',.9),2),bankLine=makeLine(lineMat('#ffffff',.4),3),objBank=makeLine(lineMat('#ffd96a',.42),2)
 function setLine(line,pts){const a=line.geometry.attributes.position;pts.forEach((p,i)=>a.setXYZ(i,tx(p.x),1.4,tz(p.y)));a.needsUpdate=true;line.geometry.setDrawRange(0,pts.length);line.visible=pts.length>1}
 const ghost=new THREE.Mesh(ballGeo,new THREE.MeshBasicMaterial({color:'#ffffff',transparent:true,opacity:.22,depthWrite:false}))
 ghost.renderOrder=4;ghost.visible=false;scene.add(ghost)

 const cue=new THREE.Group()
 {
  // Built from the tip back (-x). The ferrule, maple shaft, steel joint, inlaid
  // forearm, linen wrap, sleeve and bumper are all separate parts, as on a real cue.
  const grainCanvas=(w,h,base,dark,light)=>{const c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d');g.fillStyle=base;g.fillRect(0,0,w,h)
   for(let i=0;i<110;i++){g.strokeStyle=Math.random()<.6?dark:light;g.globalAlpha=.05+Math.random()*.14;g.lineWidth=.8+Math.random()*1.8;const x=Math.random()*w;g.beginPath();g.moveTo(x,0);g.lineTo(x+(Math.random()-.5)*6,h);g.stroke()}g.globalAlpha=1;return c}
  const maple=tex(grainCanvas(128,256,cueStyle.shaft,'#a58b58','#fff4d2'))
  const inlayCanvas=()=>{const c=document.createElement('canvas');c.width=c.height=256;const g=c.getContext('2d');g.fillStyle=cueStyle.butt;g.fillRect(0,0,256,256)
   // veneer points, narrow ends toward the tip (the bottom of the canvas)
   for(let k=0;k<4;k++){const x=k*64+32;g.fillStyle=cueStyle.shaft;g.beginPath();g.moveTo(x-20,20);g.lineTo(x+20,20);g.lineTo(x,150);g.closePath();g.fill()
    g.fillStyle='rgba(0,0,0,.5)';g.beginPath();g.moveTo(x-9,20);g.lineTo(x+9,20);g.lineTo(x,88);g.closePath();g.fill()}
   g.fillStyle='#d9b35d';g.fillRect(0,4,256,5);g.fillRect(0,236,256,5);return c}
  const linenCanvas=()=>{const c=document.createElement('canvas');c.width=c.height=64;const g=c.getContext('2d');g.fillStyle='#181513';g.fillRect(0,0,64,64);g.strokeStyle='#37312c';g.lineWidth=1.4
   for(let i=0;i<64;i+=4){g.beginPath();g.moveTo(i,0);g.lineTo(i,64);g.stroke();g.beginPath();g.moveTo(0,i);g.lineTo(64,i);g.stroke()}return c}
  const seg=(x0,len,rTip,rButt,mat)=>{const m=new THREE.Mesh(new THREE.CylinderGeometry(rButt,rTip,len,28,1),mat);m.rotation.z=Math.PI/2;m.position.x=x0-len/2;m.castShadow=true;cue.add(m);return m}
  const steel=new THREE.MeshStandardMaterial({color:'#cfd3d8',roughness:.3,metalness:.85}),gold=new THREE.MeshStandardMaterial({color:'#d9b35d',roughness:.3,metalness:.85})
  seg(3,3,2.5,2.5,std(cueStyle.tip,.85))
  const dome=new THREE.Mesh(new THREE.SphereGeometry(2.5,18,8,0,Math.PI*2,0,Math.PI/2),std(cueStyle.tip,.85));dome.rotation.z=-Math.PI/2;dome.position.x=3;cue.add(dome)
  seg(0,14,2.55,2.72,std('#efe8d6',.3))
  seg(-14,176,2.72,4.15,new THREE.MeshStandardMaterial({map:maple,roughness:.38}))
  seg(-190,6,4.3,4.3,steel)
  seg(-196,70,4.4,5.2,new THREE.MeshStandardMaterial({map:tex(inlayCanvas()),roughness:.28}))
  seg(-264,2,5.4,5.4,gold)
  const linen=tex(linenCanvas(),6,3)
  seg(-266,60,5.25,5.3,new THREE.MeshStandardMaterial({map:linen,roughness:.9}))
  seg(-326,2,5.5,5.5,gold)
  seg(-328,28,5.45,5.75,new THREE.MeshStandardMaterial({color:cueStyle.butt,roughness:.25}))
  seg(-356,10,5.75,5.6,std('#0e0e0e',.85))
 }
 cue.visible=false;scene.add(cue)

 // ---- framing ----
 const base={pos:new THREE.Vector3(),up:new THREE.Vector3(0,0,-1),fov:26}
 const shot={dir:null,start:null,blend:0,applied:false},blank=new THREE.CanvasTexture(Object.assign(document.createElement('canvas'),{width:1,height:1}))
 {const c=blank.image.getContext('2d');c.fillStyle='#f7f4e9';c.fillRect(0,0,1,1);blank.needsUpdate=true;blank.colorSpace=THREE.SRGBColorSpace}
 const eye=new THREE.Vector3(),look=new THREE.Vector3(),eye1=new THREE.Vector3(),look1=new THREE.Vector3(),up=new THREE.Vector3(),UP=new THREE.Vector3(0,1,0)
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
  base.pos.copy(camera.position);base.up.copy(cam.up);base.fov=cam.fov
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
  setFelt(color){clothMat.color.set(color);cushionMat.color.set(color).multiplyScalar(.74)},
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
   // ---- follow the shot ----
   const c0=game.balls[0],rolling=options.shotCam!==false&&game.phase==='roll'&&!game.replay&&c0?.on!==false
   if(rolling&&!shot.dir){
    const v={x:c0.vx||0,y:c0.vy||0}
    if(Math.hypot(v.x,v.y)>=MIN_SPEED){shot.dir=v;shot.start={x:c0.x,y:c0.y}}
   }
   if(!rolling&&shot.blend===0)shot.dir=null
   shot.blend=stepBlend(shot.blend,rolling&&Boolean(shot.dir),dt)
   const close=shot.blend>.35
   for(const e of balls){
    if(!e)continue
    if(e.k==='stripe'&&e.mat.map!==(close?e.skin:blank)){e.mat.map=close?e.skin:blank}
    if(close){if(e.badge)e.badge.visible=false;if(e.stripe)e.stripe.visible=false}
   }
   if(shot.blend>0&&shot.dir){
    const pose=shotPose(shot.start,shot.dir,options.eyeHeight),t=smooth(shot.blend)
    if(pose){
     eye.lerpVectors(base.pos,eye1.set(tx(pose.eye.x),pose.eye.y,tz(pose.eye.z)),t)
     look.lerpVectors(TARGET,look1.set(tx(pose.look.x),pose.look.y,tz(pose.look.z)),t)
     up.lerpVectors(base.up,UP,t).normalize()
     camera.up.copy(up);camera.fov=base.fov+(SHOT_FOV-base.fov)*t
     camera.position.copy(eye);camera.lookAt(look);camera.updateProjectionMatrix();shot.applied=true
    }
   }else if(shot.applied){frame();shot.applied=false}
   const marked=game.markedPocket?game.markedPocket():game.calledPocket
   const snapped=game.snapMark?game.snapMark():null
   snapRing.visible=snapped!=null
   if(snapped!=null){const[sx,sy]=POCKETS[snapped];snapRing.position.x=tx(sx);snapRing.position.z=tz(sy)}
   ring.visible=marked!=null
   if(ring.visible){const[px,py]=POCKETS[marked];ring.position.x=tx(px);ring.position.z=tz(py)}

   const aiming=game.aiming&&game.canAim()
   cue.visible=ghost.visible=aiming
   if(!aiming){aimLine.visible=cutLine.visible=bankLine.visible=objBank.visible=false}
   else{
    const q=game.guide(),c=balls[0]?.shown||q.c
    const end={x:c.x+q.dx*q.t,y:c.y+q.dy*q.t}
    setLine(aimLine,[c,end])
    if(q.hit){
     const nx=(q.hit.x-end.x)/(2*R),ny=(q.hit.y-end.y)/(2*R),d=rayToRail(q.hit.x,q.hit.y,nx,ny)
     setLine(cutLine,[q.hit,{x:q.hit.x+nx*d,y:q.hit.y+ny*d}])
     // and on past the cushion it meets: the extended angle
     const past=bankPath(q.hit.x,q.hit.y,nx,ny,2)
     setLine(objBank,past.length>1?[past[0],past[1]]:[])
     ghost.position.set(tx(end.x),R,tz(end.y));ghost.visible=true
    }else{cutLine.visible=false;objBank.visible=false;ghost.visible=false}
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
