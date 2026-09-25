import {rack,modeOf} from './rules.js'

// Authoritative, renderer-free match state. The controller owns timing and
// input; this module owns the fields that can cross the network.
export function freshRackState(mode='8ball'){
 mode=modeOf(mode)
 return {mode,balls:rack(mode),turn:'a',phase:'aim',over:false,result:'',finished:false,
  aiming:false,groups:{a:null,b:null},assignment:null,breakShot:true,
  calledPocket:null,ballInHand:false,placed:false,score:{a:0,b:0}}
}

// One decimal place for motion, whole units for position: position only
// needs to be visually right, but velocity feeds a receiver's local physics
// prediction between snapshots, and a slow roll or a draw shot's backspin is
// exactly the case where rounding to the nearest whole unit would read as no
// motion at all.
const round1=n=>Math.round(n*10)/10
export function snapshotOf(g){
 return {t:'state',v:2,mode:modeOf(g.mode),
  b:g.balls.map(b=>[Math.round(b.x),Math.round(b.y),b.on,b.k,b.n,
   round1(b.vx),round1(b.vy),round1(b.wx),round1(b.wy),round1(b.wz),...(b.z>0?[round1(b.z),round1(b.vz||0)]:[])]),
  turn:g.turn,phase:g.phase,over:g.over,result:g.result||'',round:g.round,
  groups:g.groups,assignment:g.assignment,breakShot:g.breakShot,
  ballInHand:g.ballInHand,calledPocket:g.calledPocket,score:g.score||{a:0,b:0}}
}

export function applySnapshot(g,s){
 // A ball tuple with only 5 fields is the pre-prediction (v1) shape, from a
 // stale tab that hasn't reloaded since a deploy -- fall back to no motion
 // rather than reading garbage out of fields that were never sent.
 g.balls=s.b.map(([x,y,on,k,n,vx,vy,wx,wy,wz,z,vz])=>
  ({id:n,x,y,on,k,n,vx:vx||0,vy:vy||0,wx:wx||0,wy:wy||0,wz:wz||0,z:z||0,vz:vz||0}))
 g.mode=modeOf(s.mode)   // absent on a snapshot from before nine-ball existed
 g.turn=s.turn;g.phase=s.phase;g.over=s.over;g.round=s.round;g.groups=s.groups
 g.assignment=s.assignment||null;g.breakShot=s.breakShot;g.ballInHand=s.ballInHand
 g.calledPocket=s.calledPocket
 g.score=s.score||{a:0,b:0}   // absent before bank pool and one-pocket existed
}
