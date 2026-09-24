// DOM input adapter. Keeping this separate lets PoolGame remain concerned with
// match state and exposes one small surface for future mobile controls.
export function bindGameInput(game){
 const h=game.handlers={
  power:()=>game.powerOut.textContent=game.power.value+'%',
  down:e=>{if(!game.canControl())return;const p=game.point(e);if(!p)return;const cue=game.balls[0];if(game.ballInHand){if(!game.validCueSpot(p))return;cue.x=p.x;cue.y=p.y;game.ballInHand=false;game.placed=true;game.pendingPlace=[p.x,p.y];game.flash('Ball in hand placed · tap again to aim');return}if(game.canCallEight()&&game.calledPocket==null){game.calledPocket=game.nearestPocket(p);game.flash('8-ball pocket marked · tap again to aim');return}const a=Math.atan2(p.y-cue.y,p.x-cue.x);if(!game.aiming)game.angle=a;game.aiming=true;game.drag=true;game.pointerAngle=a;game.surface.setPointerCapture?.(e.pointerId)},
  move:e=>{if(!game.drag)return;const p=game.point(e);if(!p)return;const cue=game.balls[0];if(Math.hypot(p.x-cue.x,p.y-cue.y)<5)return;const a=Math.atan2(p.y-cue.y,p.x-cue.x);game.angle=game.aimStep(game.angle,game.pointerAngle,a);game.pointerAngle=a},
  up:e=>{h.move(e);game.drag=false;game.surface.releasePointerCapture?.(e.pointerId)},
  shoot:()=>game.takeShot(),
  moveCue:()=>{if(!game.canControl()||game.ballInHand||!game.placed)return;game.ballInHand=true;game.placed=false;game.aiming=false;game.drag=false;game.flash('Tap the table to place the cue ball')},
  changePocket:()=>{if(!game.canControl()||game.ballInHand||!game.canCallEight()||game.calledPocket==null)return;game.calledPocket=null;game.aiming=false;game.drag=false;game.flash('Tap a pocket to mark the 8-ball')}
 }
 game.power.addEventListener('input',h.power);game.surface.addEventListener('pointerdown',h.down);game.surface.addEventListener('pointermove',h.move);game.surface.addEventListener('pointerup',h.up);game.shoot.addEventListener('click',h.shoot)
 game.moveCue?.addEventListener('click',h.moveCue);game.changePocket?.addEventListener('click',h.changePocket)
 if(game.spinPad){game.spinDot=game.spinPad.firstElementChild;Object.assign(h,{spinDown:e=>{game.spinDragging=true;game.spinFrom(e);game.spinPad.setPointerCapture?.(e.pointerId)},spinMove:e=>{if(game.spinDragging)game.spinFrom(e)},spinUp:()=>{game.spinDragging=false},spinReset:()=>game.setSpin(0,0)});game.spinPad.addEventListener('pointerdown',h.spinDown);game.spinPad.addEventListener('pointermove',h.spinMove);game.spinPad.addEventListener('pointerup',h.spinUp);game.spinPad.addEventListener('dblclick',h.spinReset);game.setSpin(0,0)}
 return ()=>{game.power.removeEventListener('input',h.power);game.surface.removeEventListener('pointerdown',h.down);game.surface.removeEventListener('pointermove',h.move);game.surface.removeEventListener('pointerup',h.up);game.shoot.removeEventListener('click',h.shoot);game.moveCue?.removeEventListener('click',h.moveCue);game.changePocket?.removeEventListener('click',h.changePocket);if(game.spinPad){game.spinPad.removeEventListener('pointerdown',h.spinDown);game.spinPad.removeEventListener('pointermove',h.spinMove);game.spinPad.removeEventListener('pointerup',h.spinUp);game.spinPad.removeEventListener('dblclick',h.spinReset)}}
}
