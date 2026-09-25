// The follow-the-shot camera: while balls are rolling, the 3D view swings to where
// the cue was, behind the cue ball and looking down the line of the shot, as if the
// player were standing at the table. When everything stops it swings back.
//
// Pure maths here (poses in table coordinates, and the blend), so it can be tested;
// render3d.js does the moving of the actual camera.

export const BEHIND=120      // how far back from the cue ball the eye is
export const HEIGHT=46       // eye height above the cloth; rails are 18 high
export const LOOK_AHEAD=260  // the point looked at, along the shot
export const FOV=58
export const MIN_SPEED=5     // a cue ball slower than this has no direction worth following
export const IN_SECONDS=.7,OUT_SECONDS=.55

// Eye and look-at for a shot from `cue` (table coordinates) heading along v.
// Returns null when there is no usable direction. x/z are table x/y; y is height.
export function shotPose(cue,v){
 const m=Math.hypot(v.x,v.y)
 if(!(m>=MIN_SPEED))return null
 const dx=v.x/m,dy=v.y/m
 return {eye:{x:cue.x-dx*BEHIND,y:HEIGHT,z:cue.y-dy*BEHIND},look:{x:cue.x+dx*LOOK_AHEAD,y:6,z:cue.y+dy*LOOK_AHEAD}}
}

// Move the blend (0 = normal view, 1 = shot view) toward its target.
export function stepBlend(blend,toward,dt){
 const rate=toward?1/IN_SECONDS:1/OUT_SECONDS
 return toward?Math.min(1,blend+dt*rate):Math.max(0,blend-dt*rate)
}

export const smooth=t=>t*t*(3-2*t)
