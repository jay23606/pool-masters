// The host is authoritative. State messages flow host → everyone; commands
// may flow only from the player occupying seat b → host. Spectators never get
// a path to influence a rack.
export function acceptsGameMessage({isHost,from,seatB}){
 return !isHost||from===seatB
}
