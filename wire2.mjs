import fs from 'fs'
const one=(p,a,b)=>{let s=fs.readFileSync(p,'utf8');const n=s.split(a).length-1;if(n!==1)throw new Error(p+': '+n+' for '+a.slice(0,60));fs.writeFileSync(p,s.replace(a,b))}

one('src/pool.js',' this.draw(dt);this.raf=requestAnimationFrame(x=>this.loop(x))}',
 ' this.sfx?.update(this.balls)\n  this.draw(dt);this.raf=requestAnimationFrame(x=>this.loop(x))}')
one('src/pool.js',"this.aiming=false;this.startShot();if(this.host)strike(",
 "this.aiming=false;this.sfx?.cue(+this.power.value/100);this.startShot();if(this.host)strike(")

one('src/main.js',"import { createRenderer2D } from './render2d.js'",
 "import { createRenderer2D } from './render2d.js'\nimport { createSfx } from './sfx.js'")
one('src/main.js','const view={mode:',
 "const sfx=createSfx()\nsfx.setEnabled(localStorage.getItem('pool-masters:muted')!=='1')\n// an AudioContext may only start from a gesture, so take the first one going\naddEventListener('pointerdown',()=>sfx.resume(),{once:true})\nconst view={mode:")
one('src/main.js','title="Switch table view: top-down 3D, angled 3D, flat 2D">TOP</button>',
 'title="Switch table view: top-down 3D, angled 3D, flat 2D">TOP</button><button id="mute-sfx" class="view-toggle sfx-toggle" title="Table sound"></button>')
one('src/main.js',"$('#view-3d').addEventListener('pointerdown',e=>e.stopPropagation())",
 `$('#mute-sfx').addEventListener('pointerdown',e=>e.stopPropagation())
 const paintSfx=()=>{$('#mute-sfx').textContent=sfx.enabled?'♪':'✕';$('#mute-sfx').classList.toggle('on',sfx.enabled)}
 $('#mute-sfx').onclick=()=>{sfx.setEnabled(!sfx.enabled);localStorage.setItem('pool-masters:muted',sfx.enabled?'0':'1');paintSfx()}
 paintSfx()
 $('#view-3d').addEventListener('pointerdown',e=>e.stopPropagation())`)

one('src/style.css','.view-toggle.on{','.sfx-toggle{right:58px;min-width:30px;font-size:.8rem;padding:.3rem .45rem}.view-toggle.on{')
console.log('ok')
