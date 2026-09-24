import { createRenderer2D } from './render2d.js'
import { TABLE_SIZES,setTableSize } from './table.js'
import { saveTablePrefs } from './preferences.js'

// Table-view and renderer lifecycle, pulled out of main.js because it's the
// one piece of that file with a genuinely clean boundary: it only needs DOM
// refs, the table preferences, and a couple of callbacks into the running
// game. Everything else in main.js (rooms, spectators, chat, ranking) is
// mutually coupled through shared state in a way that doesn't split cleanly
// without a test suite to catch a wiring mistake -- this does.
//
// `deps`: {$, tablePrefs, toast, getGame, broadcastGame, isOnlineHost}
// `getGame`/`isOnlineHost` are functions rather than values so this always
// sees the current game/room, not whatever was current when it was built.
export function createViewManager(deps){
 const {$,tablePrefs,toast,getGame,broadcastGame,isOnlineHost}=deps
 const VIEWS=['top','3d','2d'],VIEW_LABEL={top:'TOP','3d':'3D','2d':'2D'}
 // New storage key: the old one was written on every load rather than on a
 // deliberate switch, so a value stored under it said nothing about what the
 // player actually chose.
 const stored=localStorage.getItem('pool-masters:table-view')
 const view={mode:VIEWS.includes(stored)?stored:'top',renderer:null,switching:false}
 const cameraFor=m=>m==='3d'?'angled':'top'

 // The renderer is swappable at any time: the game owns the simulation, the
 // renderer only draws it and maps pointer events back to table coordinates.
 async function buildRenderer(){
  if(view.mode!=='2d'){
   try{const{createRenderer3D}=await import('./render3d.js');return await createRenderer3D($('#table3d'),cameraFor(view.mode),tablePrefs)}
   catch(e){console.warn('3D renderer unavailable',e);view.mode='2d';toast('3D is unavailable on this device')}
  }
  return createRenderer2D($('#table'),tablePrefs)
 }
 async function rebuildRenderer(){view.renderer?.destroy();view.renderer=null;await applyView(false)}
 async function applyTablePrefs(size=tablePrefs.size,felt=tablePrefs.felt,{fresh=true,remote=false}={}){
  tablePrefs.size=setTableSize(size);tablePrefs.felt=felt
  Object.assign(tablePrefs,saveTablePrefs(tablePrefs))
  await rebuildRenderer()
  if(!remote&&isOnlineHost())broadcastGame({t:'table',size:tablePrefs.size,felt:tablePrefs.felt})
  const game=getGame()
  if(fresh&&game){game.resetRack();game.sync()}
  if(!remote)toast(`${TABLE_SIZES[tablePrefs.size].label} table ready`)
 }
 async function applyView(persist){
  if(view.switching)return
  view.switching=true
  try{
   if(view.mode!=='2d'&&view.renderer?.mode==='3d')view.renderer.setCamera(cameraFor(view.mode))
   else{
    const next=await buildRenderer()
    view.renderer?.destroy();view.renderer=next
    getGame()?.setRenderer(next)
   }
   const r=view.renderer
   $('#table').hidden=r.mode!=='2d';$('#table3d').hidden=r.mode!=='3d'
   $('#view-3d').textContent=VIEW_LABEL[view.mode]
   $('#view-3d').classList.toggle('on',r.mode==='3d')
   if(persist)localStorage.setItem('pool-masters:table-view',view.mode)
   r.resize()
  }finally{view.switching=false}
 }
 async function ensureRenderer(){if(!view.renderer)await applyView();return view.renderer}
 function cycle(){view.mode=VIEWS[(VIEWS.indexOf(view.mode)+1)%VIEWS.length];applyView(true)}
 function forceView(mode){view.mode=mode;return applyView(false)}

 return {view,cameraFor,applyTablePrefs,applyView,ensureRenderer,cycle,forceView}
}
