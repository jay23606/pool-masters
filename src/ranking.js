// The game represents players as a (room host) and b (guest), while Supabase
// records stable profile IDs. Keep that mapping pure and tested: result events
// carry {winner, round}, not a bare winner string.
export function winnerForResult(result,isHost,selfId,opponentId){
 const winner=typeof result==='string'?result:result?.winner
 if(winner!=='a'&&winner!=='b')return null
 return winner==='a'?(isHost?selfId:opponentId):(isHost?opponentId:selfId)
}
