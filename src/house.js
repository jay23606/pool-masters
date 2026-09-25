import {other} from './rules.js'

// House rules: the choices whoever hosts a game can make. Pure data and functions, so they can be
// validated and tested; the game reads them, the lobby's dialog writes them, and an online table
// carries them in its room settings so both players play the same game.
//
//   race         how many racks win a match
//   ballInHand   after a foul: anywhere on the table, only behind the head string, or none (the
//                cue ball stays where it stopped, and goes back on the head spot if it was potted)
//   breaker      who breaks each rack: always the host, taking turns, the winner, or the loser
//   straightTo   the score that wins straight pool
//
// Ranked games are only ever played by the standard rules.

export const RACES=[1,2,3,4,5,7]
export const BALL_IN_HAND=['anywhere','kitchen','none']
export const BREAKERS=['host','alternate','winner','loser']
export const STRAIGHT_TARGETS=[15,30,50,100]

export const DEFAULT_HOUSE={race:3,ballInHand:'anywhere',breaker:'host',straightTo:30}

// The head string: behind it is "the kitchen".
export const HEAD_STRING=175

// Anything read from storage or from another player's room settings is untrusted: keep what is
// valid and put the default in place of the rest.
export function normalizeHouse(h){
 const o=h&&typeof h==='object'?h:{}
 return {
  race:RACES.includes(o.race)?o.race:DEFAULT_HOUSE.race,
  ballInHand:BALL_IN_HAND.includes(o.ballInHand)?o.ballInHand:DEFAULT_HOUSE.ballInHand,
  breaker:BREAKERS.includes(o.breaker)?o.breaker:DEFAULT_HOUSE.breaker,
  straightTo:STRAIGHT_TARGETS.includes(o.straightTo)?o.straightTo:DEFAULT_HOUSE.straightTo
 }
}

export const isDefault=h=>{const n=normalizeHouse(h);return Object.keys(DEFAULT_HOUSE).every(k=>n[k]===DEFAULT_HOUSE[k])}

const BIH_WORDS={anywhere:'ball in hand anywhere',kitchen:'ball in hand behind the head string',none:'cue ball where it stopped'}
const BREAK_WORDS={host:'the host always breaks',alternate:'breaks alternate',winner:'the winner breaks',loser:'the loser breaks'}
export const words={ballInHand:BIH_WORDS,breaker:BREAK_WORDS}

// The rules that differ from standard, in a short line; '' when they are all standard.
export function describe(h){
 const n=normalizeHouse(h),parts=[]
 if(n.race!==DEFAULT_HOUSE.race)parts.push(`race to ${n.race}`)
 if(n.ballInHand!==DEFAULT_HOUSE.ballInHand)parts.push(BIH_WORDS[n.ballInHand])
 if(n.breaker!==DEFAULT_HOUSE.breaker)parts.push(BREAK_WORDS[n.breaker])
 if(n.straightTo!==DEFAULT_HOUSE.straightTo)parts.push(`straight pool to ${n.straightTo}`)
 return parts.join(' · ')
}

// Who breaks the next rack. `last` is {breaker, winner} of the rack just played (none for the first).
export function nextBreaker(h,last){
 const {breaker}=normalizeHouse(h)
 const lastBreaker=last?.breaker,winner=last?.winner
 if(breaker==='alternate')return lastBreaker?other(lastBreaker):'a'
 if(breaker==='winner')return winner==='a'||winner==='b'?winner:'a'
 if(breaker==='loser')return winner==='a'||winner==='b'?other(winner):'a'
 return 'a'
}

// Where the cue ball may be placed after a foul: the whole table, or only behind the head string.
export const placementLimit=h=>normalizeHouse(h).ballInHand==='kitchen'?HEAD_STRING:null
