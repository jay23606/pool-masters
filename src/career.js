// Career: a ladder of ten opponents, each a short match in one of the four games, at a rising
// level of the AI. Beat one to open the next; any beaten opponent can be played again. Pure data and
// functions, so the ladder and its rules can be tested; main.js plays the matches and keeps the
// progress in the browser. Nothing here needs a server.
//
// `race` is how many racks win the match. The scored games (bank pool, one-pocket) are already a
// long game in one rack, so those are a single rack.

export const LADDER=[
 {id:'ray',   name:'Rookie Ray',        venue:'The Rusty Cue',      bio:'Bought his first cue last week and has been telling everyone since.', level:'novice',  mode:'8ball',     race:2},
 {id:'dee',   name:'Diner Dee',         venue:'Sunrise Diner',      bio:'Runs the table between breakfast rushes. Nine-ball, no fuss.',        level:'beginner',mode:'9ball',     race:2},
 {id:'bo',    name:'Barfly Bo',         venue:'Last Call Lounge',   bio:'Has never lost a game he was allowed to finish.',                     level:'beginner',mode:'8ball',     race:3},
 {id:'bea',   name:'Banker Bea',        venue:'The Rail Room',      bio:'Doesn\'t trust a straight shot. Everything goes off a cushion.',      level:'club',    mode:'bank',      race:1},
 {id:'cal',   name:'Clubman Cal',       venue:'Northside Billiards',bio:'Fifteen years in the Tuesday league and a very good cue case.',      level:'club',    mode:'8ball',     race:3},
 {id:'ollie', name:'One-Pocket Ollie',  venue:'Ollie\'s Back Room', bio:'Will take an hour over a single shot and be right about it.',        level:'league',  mode:'onepocket', race:1},
 {id:'nina',  name:'Nine-Ball Nina',    venue:'The Golden Rack',    bio:'Breaks like a door being kicked in.',                                 level:'league',  mode:'9ball',     race:3},
 {id:'sam',   name:'Sharp Sam',         venue:'Hustler\'s Hall',    bio:'Loses the first game on purpose. You only find out later.',          level:'ace',     mode:'8ball',     race:3},
 {id:'bianca',name:'Bank Boss Bianca',  venue:'The Long Rail',      bio:'Has banked a ball from behind the head string and framed the photo.', level:'ace',     mode:'bank',      race:1},
 {id:'legend',name:'The Legend',        venue:'The Championship',   bio:'Nobody has seen them miss. Nobody has seen them play twice.',        level:'legend',  mode:'9ball',     race:4}
]

export const emptyCareer=()=>({beaten:{}})

const clean=p=>p&&typeof p==='object'&&p.beaten&&typeof p.beaten==='object'?p:emptyCareer()

export const byId=id=>LADDER.find(o=>o.id===id)||null
export const isBeaten=(progress,id)=>Boolean(clean(progress).beaten[id])
export const beatenCount=progress=>LADDER.filter(o=>isBeaten(progress,o.id)).length

// An opponent is open if it is the first, or the one before it has been beaten.
export function isOpen(progress,id){
 const i=LADDER.findIndex(o=>o.id===id)
 if(i<0)return false
 return i===0||isBeaten(progress,LADDER[i-1].id)
}

// The first opponent not yet beaten; null once the ladder is done.
export const nextOpponent=progress=>LADDER.find(o=>!isBeaten(progress,o.id))||null

// A win is recorded once; losing never takes anything away. Returns a new progress object.
export function recordWin(progress,id,when=Date.now()){
 const p=clean(progress)
 if(!byId(id)||p.beaten[id])return p
 return {...p,beaten:{...p.beaten,[id]:{at:when}}}
}

export const isChampion=progress=>beatenCount(progress)===LADDER.length

// The words for a finished match.
export function summaryOf(opponent,won,progressAfter){
 if(!won)return `${opponent.name} takes it. Have another go.`
 const next=nextOpponent(progressAfter)
 return next?`You beat ${opponent.name}. Next up: ${next.name} at ${next.venue}.`:`You beat ${opponent.name}, and the whole circuit. You are the champion.`
}
