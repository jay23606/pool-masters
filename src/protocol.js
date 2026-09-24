const groups=new Set(['cue','solid','stripe','eight'])
const phase=new Set(['aim','roll'])
const player=new Set(['a','b'])
const finite=n=>typeof n==='number'&&Number.isFinite(n)
const expectedGroup=n=>n===0?'cue':n===8?'eight':n<8?'solid':'stripe'

export function isGameMessage(m){
 if(!m||typeof m!=='object'||typeof m.t!=='string')return false
 if(m.t==='next-rack')return true
 if(m.t==='table')return finite(m.size)&&typeof m.felt==='string'
 if(m.t==='shot')return finite(m.vx)&&finite(m.vy)&&(!m.spin||Array.isArray(m.spin)&&m.spin.every(finite))
 if(m.t!=='state'||!Array.isArray(m.b)||!player.has(m.turn)||!phase.has(m.phase)||!Number.isInteger(m.round))return false
 if(m.b.length!==16||!m.b.every(b=>Array.isArray(b)&&b.length===5&&finite(b[0])&&finite(b[1])&&typeof b[2]==='boolean'&&groups.has(b[3])&&Number.isInteger(b[4])&&b[4]>=0&&b[4]<=15&&b[3]===expectedGroup(b[4])))return false
 if(new Set(m.b.map(b=>b[4])).size!==16)return false
 return m.groups&&['a','b'].every(p=>m.groups[p]===null||m.groups[p]==='solid'||m.groups[p]==='stripe')
}

export function parseGameMessage(raw){
 try{const m=JSON.parse(raw);return isGameMessage(m)?m:null}catch{return null}
}
