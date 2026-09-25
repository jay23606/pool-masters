import {TROPHIES} from './trophies.js'

// Cosmetics: what a table, a cue and its rails can look like, and which of them a trophy unlocks.
// The game has no ads and no purchases, so these are earned, and only ever new: everything a
// player could choose before is still free. Pure data and functions, so the unlock rules can be
// tested; the renderers read the palettes, the settings dialog reads the catalogue.

export const FELTS={green:'#17794b',blue:'#176c88',burgundy:'#712e3c',charcoal:'#34443d',
 royal:'#4b2f7a',sunset:'#b4552a',ice:'#5b8fa1',black:'#1d2422',velvet:'#7a1f3d'}

export const CUE_STYLES={
 classic:{shaft:'#e6d6ab',butt:'#4a2a18',tip:'#4e8fa6'},
 ebony:{shaft:'#d8c49e',butt:'#171414',tip:'#d9b35d'},
 midnight:{shaft:'#c7d0d7',butt:'#102b52',tip:'#71c4e9'},
 gold:{shaft:'#f2e3b5',butt:'#8c6a1c',tip:'#3a79b8'},
 crimson:{shaft:'#e9d9b0',butt:'#7a1220',tip:'#c9a24d'},
 carbon:{shaft:'#c9cdd2',butt:'#1a1d21',tip:'#59d6a4'},
 galaxy:{shaft:'#cfc6ea',butt:'#2a1650',tip:'#e16ad0'},
 champion:{shaft:'#f4ecd0',butt:'#0d0d0f',tip:'#d9b35d'}
}

// the three colours of the wood-grain texture: the ground, the dark streaks and the light ones
export const RAIL_STYLES={
 walnut:{base:'#5b2f19',dark:'#2a1208',light:'#94582f'},
 maple:{base:'#b98a52',dark:'#7a5028',light:'#e0b880'},
 cherry:{base:'#7a2e1b',dark:'#3d1408',light:'#b0583a'},
 ebony:{base:'#2a2320',dark:'#0e0a08',light:'#514640'}
}

export const DEFAULTS={cue:'classic',felt:'green',rails:'walnut'}

// kind, the key it is stored and drawn by, what the player sees, and the trophy that unlocks it
// (none: free)
export const COSMETICS=[
 {kind:'cue',key:'classic',name:'Classic maple'},
 {kind:'cue',key:'ebony',name:'Ebony'},
 {kind:'cue',key:'midnight',name:'Midnight blue'},
 {kind:'cue',key:'gold',name:'Gold leaf',trophy:'ten-racks'},
 {kind:'cue',key:'crimson',name:'Crimson',trophy:'first-drill'},
 {kind:'cue',key:'carbon',name:'Carbon',trophy:'on-a-roll'},
 {kind:'cue',key:'galaxy',name:'Galaxy',trophy:'beat-pro'},
 {kind:'cue',key:'champion',name:'Champion',trophy:'career-all'},

 {kind:'felt',key:'green',name:'Classic green'},
 {kind:'felt',key:'blue',name:'Tournament blue'},
 {kind:'felt',key:'burgundy',name:'Burgundy'},
 {kind:'felt',key:'charcoal',name:'Charcoal'},
 {kind:'felt',key:'royal',name:'Royal purple',trophy:'match'},
 {kind:'felt',key:'sunset',name:'Sunset',trophy:'daily-first'},
 {kind:'felt',key:'ice',name:'Ice',trophy:'beat-league'},
 {kind:'felt',key:'black',name:'Black',trophy:'fifty-racks'},
 {kind:'felt',key:'velvet',name:'Velvet',trophy:'career-5'},

 {kind:'rails',key:'walnut',name:'Walnut'},
 {kind:'rails',key:'maple',name:'Maple',trophy:'first-rack'},
 {kind:'rails',key:'cherry',name:'Cherry',trophy:'nine-ball'},
 {kind:'rails',key:'ebony',name:'Ebony',trophy:'clean-hands'}
]

export const ofKind=kind=>COSMETICS.filter(c=>c.kind===kind)
export const find=(kind,key)=>COSMETICS.find(c=>c.kind===kind&&c.key===key)

// \`earned\` is the map of trophy id to when, as the trophy case keeps it.
export const isUnlocked=(item,earned)=>!item.trophy||Boolean(earned?.[item.trophy])

// The trophy that unlocks an item, for the "earn ..." note; null for a free item.
export const trophyFor=item=>item.trophy?TROPHIES.find(t=>t.id===item.trophy)||null:null

// What a trophy gives, for the trophy case and the unlock toast.
export const rewardsOf=trophyId=>COSMETICS.filter(c=>c.trophy===trophyId)

// What a player should be shown for a choice: a name, and if it is locked, how to get it.
export function label(item,earned){
 if(isUnlocked(item,earned))return item.name
 const t=trophyFor(item)
 return `🔒 ${item.name} — earn “${t?t.name:item.trophy}”`
}

// A player can only have picked what they have: a stored choice for something still locked (an
// edited or copied setting) falls back to the default for its kind.
export function usable(kind,key,earned){
 const item=find(kind,key)
 return item&&isUnlocked(item,earned)?key:DEFAULTS[kind]
}
