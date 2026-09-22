import fs from 'fs'
const one=(p,a,b,expect=1)=>{let s=fs.readFileSync(p,'utf8');const n=s.split(a).length-1;if(n!==expect)throw new Error(p+': '+n+' for '+a.slice(0,60));fs.writeFileSync(p,s.replace(a,b))}

// the power curve belongs with the physics it feeds
one('src/physics.js','export const G=2414                 // gravity, units/s^2',
 'export const G=2414                 // gravity, units/s^2\n\n// power slider percentage -> launch speed\nexport const shotSpeed=v=>120+Math.pow(Math.max(1,Math.min(100,v))/100,1.45)*3080')
one('src/ai.js',"import {integrate,railBounce,substeps,atRest,strike} from './physics.js'\nimport {remaining,validCueSpot,nearestPocket} from './rules.js'\n\n",
 "import {integrate,railBounce,substeps,atRest,strike,shotSpeed} from './physics.js'\nimport {remaining,validCueSpot,nearestPocket} from './rules.js'\n\n")
one('src/ai.js','export const shotSpeed=v=>120+Math.pow(Math.max(1,Math.min(100,v))/100,1.45)*3080\n\n','')

let s=fs.readFileSync('src/pool.js','utf8')
const rep=(a,b)=>{const n=s.split(a).length-1;if(n!==1)throw new Error('pool: '+n+' for '+a.slice(0,60));s=s.replace(a,b)}

rep("import {R,PR,MINX,MAXX,MINY,MAXY,POCKETS} from './table.js'\nimport {integrate,railBounce,ballCollide,substeps,atRest,clearMotion,strike} from './physics.js'\nexport const shotSpeed=v=>120+Math.pow(Math.max(1,Math.min(100,v))/100,1.45)*3080",
 "import {R,PR,MINX,MAXX,MINY,MAXY,POCKETS} from './table.js'\nimport {integrate,railBounce,ballCollide,substeps,atRest,clearMotion,strike,shotSpeed} from './physics.js'\nimport {other,rack,remaining as countLeft,nearestPocket,validCueSpot,judgeShot,opposite} from './rules.js'\nimport {chooseShot} from './ai.js'\nexport {shotSpeed}")

rep("// Measured from the collision model: throw rises with the cut angle and then\n// saturates once ball-on-ball friction is fully mobilised, at about 3.4 degrees.\nconst THROW_MAX=.06,THROW_K=.155\n",'')
rep("const kind=n=>n===8?'eight':n<8?'solid':'stripe',other=t=>t==='a'?'b':'a',shuffle=a=>a.sort(()=>Math.random()-.5)\n",'')
rep(/function rack\(\)\{[^\n]*\n/,'')

rep(" nearestPocket(p){return POCKETS.reduce((best,x,i)=>Math.hypot(p.x-x[0],p.y-x[1])<best.d?{i,d:Math.hypot(p.x-x[0],p.y-x[1])}:best,{i:0,d:Infinity}).i}",
 " nearestPocket(p){return nearestPocket(p)}")
rep(" validCueSpot(p){return p.x>=MINX&&p.x<=MAXX&&p.y>=MINY&&p.y<=MAXY&&!this.balls.some(b=>b.k!=='cue'&&b.on&&Math.hypot(b.x-p.x,b.y-p.y)<2*R)}",
 " validCueSpot(p){return validCueSpot(this.balls,p)}")
rep(" remaining(group){return this.balls.filter(b=>b.on&&b.k===group).length}",
 " remaining(group){return countLeft(this.balls,group)}")
fs.writeFileSync('src/pool.js',s)
console.log('ok')
