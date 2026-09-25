// Where a pointer is on a table canvas, as fractions (0..1) of its width and height.
//
// On a phone held upright the table is turned a quarter turn, so its long side runs
// down the screen and it can fill the width. The CSS marks that with --rot: 1 on
// the canvas's wrapper. A quarter turn clockwise sends the table's +x down the
// screen and its +y to the left, so a point on screen (u, v) across and down the
// rotated box is at (v, 1 - u) on the table.
export function tableFractions(canvas,e){
 const r=canvas.getBoundingClientRect()
 const u=(e.clientX-r.left)/r.width,v=(e.clientY-r.top)/r.height
 const wrap=canvas.parentElement
 const rotated=wrap&&typeof getComputedStyle==='function'&&getComputedStyle(wrap).getPropertyValue('--rot').trim()==='1'
 return rotated?{fx:v,fy:1-u}:{fx:u,fy:v}
}
