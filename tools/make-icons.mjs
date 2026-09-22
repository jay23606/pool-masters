// Renders the app icons to PNG with no image dependencies: signed-distance
// shapes, supersampled, then a minimal PNG encoder over node's zlib.
import {deflateSync} from 'node:zlib'
import {writeFileSync,mkdirSync} from 'node:fs'

const CRC=(()=>{const t=new Int32Array(256)
 for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c}
 return b=>{let c=~0;for(const x of b)c=t[(c^x)&255]^(c>>>8);return ~c>>>0}})()

function chunk(type,data){
 const len=Buffer.alloc(4);len.writeUInt32BE(data.length)
 const body=Buffer.concat([Buffer.from(type,'latin1'),data])
 const crc=Buffer.alloc(4);crc.writeUInt32BE(CRC(body))
 return Buffer.concat([len,body,crc])
}
function png(w,h,rgba){
 const raw=Buffer.alloc((w*4+1)*h)
 for(let y=0;y<h;y++){raw[y*(w*4+1)]=0;rgba.copy(raw,y*(w*4+1)+1,y*w*4,(y+1)*w*4)}
 const ihdr=Buffer.alloc(13)
 ihdr.writeUInt32BE(w,0);ihdr.writeUInt32BE(h,4);ihdr[8]=8;ihdr[9]=6
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),
  chunk('IHDR',ihdr),chunk('IDAT',deflateSync(raw,{level:9})),chunk('IEND',Buffer.alloc(0))])
}

const hex=s=>[parseInt(s.slice(1,3),16),parseInt(s.slice(3,5),16),parseInt(s.slice(5,7),16)]
const mix=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t)
const cover=(d,aa)=>Math.max(0,Math.min(1,.5-d/aa))   // d<0 inside

function render(size,{pad,bg}){
 const px=Buffer.alloc(size*size*4),S=3,aa=1.6/S
 const cx=size/2,cy=size/2,R=size*(1-pad)/2
 const white=hex('#f7f4e9'),ink=hex('#12160f')
 const bgc=bg?hex(bg):null
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  let r=0,g=0,b=0,a=0
  for(let sy=0;sy<S;sy++)for(let sx=0;sx<S;sx++){
   const px0=x+(sx+.5)/S,py0=y+(sy+.5)/S
   let col=bgc?bgc.slice():[0,0,0],alpha=bgc?1:0
   const dBall=Math.hypot(px0-cx,py0-cy)-R
   const inBall=cover(dBall,aa)
   if(inBall>0){
    // shaded phenolic sphere: bright toward the upper-left, dark at the rim
    const nx=(px0-cx)/R,ny=(py0-cy)/R
    const lit=Math.max(0,1-Math.hypot(nx+.38,ny+.44)/1.25)
    const rim=Math.min(1,Math.hypot(nx,ny))
    let ball=mix(hex('#2a2a2a'),hex('#080808'),rim*rim)
    ball=mix(ball,[255,255,255],Math.pow(lit,2.2)*.85)
    col=mix(col,ball,inBall);alpha=alpha+(1-alpha)*inBall
    // the white spot, with an 8 drawn as two stacked rings
    const spot=cover(Math.hypot(px0-cx,py0-cy)-R*.46,aa)
    if(spot>0){
     col=mix(col,white,spot)
     const rr=R*.155,w=R*.062
     const top=Math.abs(Math.hypot(px0-cx,py0-(cy-rr*.92))-rr)-w
     const bot=Math.abs(Math.hypot(px0-cx,py0-(cy+rr*.92))-rr*1.12)-w
     const eight=Math.max(cover(top,aa),cover(bot,aa))*spot
     if(eight>0)col=mix(col,ink,eight)
    }
   }
   r+=col[0]*alpha;g+=col[1]*alpha;b+=col[2]*alpha;a+=alpha
  }
  const n=S*S,i=(y*size+x)*4
  px[i]=Math.round(r/n);px[i+1]=Math.round(g/n);px[i+2]=Math.round(b/n);px[i+3]=Math.round(a/n*255)
 }
 return png(size,size,px)
}

mkdirSync('public',{recursive:true})
// maskable icons get cropped to a circle by the launcher, so the ball sits
// inside the 80% safe zone on an opaque background
for(const [file,size,opts] of [
 ['public/icon-192.png',192,{pad:.06}],
 ['public/icon-512.png',512,{pad:.06}],
 ['public/icon-maskable-512.png',512,{pad:.30,bg:'#0b1c14'}],
 ['public/apple-touch-icon.png',180,{pad:.10,bg:'#0b1c14'}],
]) writeFileSync(file,render(size,opts))
console.log('icons written')
