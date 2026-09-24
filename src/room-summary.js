// Lobby rows derive occupancy from host-owned seats, not raw room presence:
// a spectator is present but must never make a two-player table look full.
export function roomOccupancy(room){
 const seats=room.metadata?.seats||{}
 const players=seats.a?1+(seats.b?1:0):Math.min(room.playerCount||0,2)
 const spectators=(room.metadata?.spectators||[]).length
 return {players,spectators}
}
export function occupancyLabel(room){
 const {players,spectators}=roomOccupancy(room)
 return `${players}/2 players${spectators?` · ${spectators} spectator${spectators===1?'':'s'}`:''}`
}
