import {TABLE_SIZES} from './table.js'

export const FELTS={green:'#17794b',blue:'#176c88',burgundy:'#712e3c',charcoal:'#34443d'}
export const TABLE_PREF_DEFAULTS={size:7,felt:FELTS.green,cue:'classic',lighting:'hall',aimSensitivity:.3,shotCam:true}
const CUES=new Set(['classic','ebony','midnight']),LIGHTING=new Set(['hall','warm','cool'])
const get=(storage,key)=>{try{return storage?.getItem(key)}catch{return null}}
const put=(storage,key,value)=>{try{storage?.setItem(key,value)}catch{}}

// Keep user-controlled cosmetics in one validated boundary. Old or malformed
// localStorage values must never make renderer setup fail.
export function loadTablePrefs(storage=globalThis.localStorage){
 const size=Number(get(storage,'pool-masters:table-size'))
 const felt=get(storage,'pool-masters:felt'),cue=get(storage,'pool-masters:cue'),lighting=get(storage,'pool-masters:lighting'),aimSensitivity=Number(get(storage,'pool-masters:aim-sensitivity'))
 return {size:TABLE_SIZES[size]?size:TABLE_PREF_DEFAULTS.size,
  felt:Object.values(FELTS).includes(felt)?felt:TABLE_PREF_DEFAULTS.felt,
  cue:CUES.has(cue)?cue:TABLE_PREF_DEFAULTS.cue,
  lighting:LIGHTING.has(lighting)?lighting:TABLE_PREF_DEFAULTS.lighting,
  aimSensitivity:aimSensitivity>=.1&&aimSensitivity<=1?aimSensitivity:TABLE_PREF_DEFAULTS.aimSensitivity,
  shotCam:get(storage,'pool-masters:shot-cam')!=='0'}
}
export function saveTablePrefs(prefs,storage=globalThis.localStorage){
 const clean=loadTablePrefs({getItem:key=>({
  'pool-masters:table-size':String(prefs.size),'pool-masters:felt':prefs.felt,
  'pool-masters:cue':prefs.cue,'pool-masters:lighting':prefs.lighting,'pool-masters:aim-sensitivity':prefs.aimSensitivity,'pool-masters:shot-cam':prefs.shotCam===false?'0':'1'}[key]??null)})
 put(storage,'pool-masters:table-size',clean.size);put(storage,'pool-masters:felt',clean.felt);put(storage,'pool-masters:cue',clean.cue);put(storage,'pool-masters:lighting',clean.lighting);put(storage,'pool-masters:aim-sensitivity',clean.aimSensitivity);put(storage,'pool-masters:shot-cam',clean.shotCam?'1':'0')
 return clean
}
