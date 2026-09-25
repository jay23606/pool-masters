import {DAILY} from './daily-data.js'

// The daily shot: one fixed table a day, the same for everyone, that a real search of
// the physics has shown can be solved (see tools/gen-daily.mjs and the tests). The
// day picks the table, and nothing else: no account, no server, so it works offline.
//
// Difficulty follows the week, easy at the start and hard at the end, as the layouts
// are graded by how wide a window of aim still pots the ball.

export const EPOCH=Date.UTC(2026,0,1)
const DAY=86400000
const SITE='https://jay23606.github.io/pool-masters/'

// Day number 1 is 1 January 2026, by the player's own calendar.
export const dayNumber=(d=new Date())=>Math.floor((Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())-EPOCH)/DAY)+1

export const levelOf=window=>window>=2.2?1:window>=1.4?2:3
// by weekday, Sunday first
const WEEK=[2,1,1,2,2,3,3]
const levelFor=n=>WEEK[new Date(EPOCH+(n-1)*DAY).getUTCDay()]

const BUCKETS={1:[],2:[],3:[]}
DAILY.forEach((d,i)=>BUCKETS[levelOf(d.window)].push(i))

// Which entry a day gets: the next unused one of its difficulty, so a table does not come
// back until every other of that difficulty has had its turn.
export function entryFor(n){
 const lv=levelFor(n)
 let seen=0
 for(let k=1;k<n;k++)if(levelFor(k)===lv)seen++
 const list=BUCKETS[lv]
 return {level:lv,entry:DAILY[list[seen%list.length]]}
}

const TIPS={
 1:'Take your time: there is a comfortable margin on this one.',
 2:'Check the line from the cue ball through the object ball to the pocket before you aim.',
 3:'A tight one. Aim for the very centre of the pocket, and try a different power if it keeps missing.'
}

// The drill for a day, in the same shape as the practice drills, so it plays the same way.
export function dailyDrill(n){
 const {level,entry}=entryFor(n),t=entry.target
 return {id:`daily-${n}`,daily:n,name:`Daily shot #${n}`,level,
  goal:`Pot the ${t}. Everyone gets this table today.`,tip:TIPS[level],
  layout:{cue:entry.cue,balls:entry.balls},win:{pot:t},hint:entry.hint}
}

export const isDaily=id=>typeof id==='string'&&/^daily-\d+$/.test(id)
export const dailyNumberOf=id=>isDaily(id)?Number(id.slice(6)):null

// What to paste to a friend. `record` is what the drill progress holds for that day.
export function shareText(n,level,record){
 const how=!record?.done?'Still working on it':record.best==null?'Solved, with a little help':record.best===1?'Potted it first go':`Potted it in ${record.best} tries`
 return `Pool Masters Daily #${n} ${'★'.repeat(level)}${'☆'.repeat(3-level)}\n${how}\n${SITE}`
}

export const dailySolved=progress=>Object.entries(progress||{}).filter(([id,r])=>isDaily(id)&&r?.done).length
