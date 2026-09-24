// Session score is deliberately separate from ranked records. A ranked result
// is durable only after both players report it; this is immediate UI state for
// the current best-of-any-length session.
export function emptyScore(){return {a:0,b:0}}
export function scoreRack(score,winner){
 if(winner!=='a'&&winner!=='b')return {...score}
 return {...score,[winner]:(score[winner]||0)+1}
}
export function scoreLine(score,me,myName,opponentName){
 const them=me==='a'?'b':'a'
 return `${myName} ${score[me]||0} — ${score[them]||0} ${opponentName}`
}
export const MATCH_TARGET=3
export function matchWinner(score,target=MATCH_TARGET){
 return score.a>=target?'a':score.b>=target?'b':null
}
