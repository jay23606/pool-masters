// Roles live in host-owned room metadata. A browser may request a role in its
// player state, but only the host can grant a seat or admit a spectator.
export const spectatorMeta=hostId=>({seats:{a:hostId,b:null},spectators:[],spectatorRequests:[]})
const unique=xs=>[...new Set(xs||[])]
export function roleFor(meta,id){
 if(meta?.seats?.a===id)return 'host'
 if(meta?.seats?.b===id)return 'player'
 if((meta?.spectators||[]).includes(id))return 'spectator'
 return 'pending'
}
export function reconcileSpectators(meta,players){
 const present=new Set(players.map(p=>p.id)),next={...meta,seats:{...meta.seats},spectators:unique(meta.spectators).filter(id=>present.has(id)),spectatorRequests:unique(meta.spectatorRequests).filter(id=>present.has(id))}
 if(next.seats.b&&!present.has(next.seats.b))next.seats.b=null
 const candidate=players.find(p=>p.id!==next.seats.a&&!next.seats.b&&p.state?.poolRole==='player')
 if(candidate)next.seats.b=candidate.id
 for(const p of players)if(p.id!==next.seats.a&&p.id!==next.seats.b&&p.state?.poolRole==='spectator'&&!next.spectators.includes(p.id)&&!next.spectatorRequests.includes(p.id))next.spectatorRequests.push(p.id)
 return next
}
export function admitSpectator(meta,id){
 if(!(meta?.spectatorRequests||[]).includes(id))return meta
 return {...meta,spectators:unique([...(meta.spectators||[]),id]),spectatorRequests:meta.spectatorRequests.filter(x=>x!==id)}
}
export function removeSpectator(meta,id){
 return {...meta,spectators:(meta?.spectators||[]).filter(x=>x!==id),spectatorRequests:(meta?.spectatorRequests||[]).filter(x=>x!==id)}
}
