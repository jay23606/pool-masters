import {rack} from './rules.js'

// Authoritative, renderer-free match state. The controller owns timing and
// input; this module owns the fields that can cross the network.
export function freshRackState(){
 return {balls:rack(),turn:'a',phase:'aim',over:false,result:'',finished:false,
  aiming:false,groups:{a:null,b:null},assignment:null,breakShot:true,
  calledPocket:null,ballInHand:false,placed:false}
}

export function snapshotOf(g){
 return {t:'state',v:1,b:g.balls.map(b=>[Math.round(b.x),Math.round(b.y),b.on,b.k,b.n]),
  turn:g.turn,phase:g.phase,over:g.over,result:g.result||'',round:g.round,
  groups:g.groups,assignment:g.assignment,breakShot:g.breakShot,
  ballInHand:g.ballInHand,calledPocket:g.calledPocket}
}

export function applySnapshot(g,s){
 g.balls=s.b.map(([x,y,on,k,n])=>({id:n,x,y,on,k,n,vx:0,vy:0,wx:0,wy:0,wz:0}))
 g.turn=s.turn;g.phase=s.phase;g.over=s.over;g.round=s.round;g.groups=s.groups
 g.assignment=s.assignment||null;g.breakShot=s.breakShot;g.ballInHand=s.ballInHand
 g.calledPocket=s.calledPocket
}
