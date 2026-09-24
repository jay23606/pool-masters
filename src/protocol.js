const groups=new Set(['cue','solid','stripe','eight'])
const phase=new Set(['aim','roll'])
const player=new Set(['a','b'])
const finite=n=>typeof n==='number'&&Number.isFinite(n)
const RACK_SIZE={'8ball':16,'9ball':10}
const expectedGroup=n=>n===0?'cue':n===8?'eight':n<8?'solid':'stripe'

export function isGameMessage(m){
 if(!m||typeof m!=='object'||typeof m.t!=='string')return false
 if(m.t==='next-rack')return true
 if(m.t==='table')return finite(m.size)&&typeof m.felt==='string'
 if(m.t==='shot')return finite(m.vx)&&finite(m.vy)&&(!m.spin||Array.isArray(m.spin)&&m.spin.every(finite))
 if(m.t!=='state'||!Array.isArray(m.b)||!player.has(m.turn)||!phase.has(m.phase)||!Number.isInteger(m.round))return false
 // A ball tuple is either the plain v1 shape (position only) or the v2 shape
 // with five more finite fields appended (velocity and spin) -- accepting
 // both means a tab still running the old build a moment after a deploy
 // degrades to no local prediction rather than dropping every state message.
 const validBall=b=>Array.isArray(b)&&(b.length===5||b.length===10)&&finite(b[0])&&finite(b[1])&&typeof b[2]==='boolean'&&groups.has(b[3])&&Number.isInteger(b[4])&&b[4]>=0&&b[4]<=15&&b[3]===expectedGroup(b[4])&&(b.length===5||b.slice(5).every(finite))
 // A snapshot without a mode is from before nine-ball existed: an 8-ball rack.
 const mode=m.mode===undefined?'8ball':m.mode,size=RACK_SIZE[mode]
 if(!size)return false
 if(m.b.length!==size||!m.b.every(validBall))return false
 if(new Set(m.b.map(b=>b[4])).size!==size)return false
 if(mode==='9ball'&&!m.b.every(b=>b[4]<=9))return false   // balls 0-9 only
 return m.groups&&['a','b'].every(p=>m.groups[p]===null||m.groups[p]==='solid'||m.groups[p]==='stripe')
}

export function parseGameMessage(raw){
 try{const m=JSON.parse(raw);return isGameMessage(m)?m:null}catch{return null}
}
