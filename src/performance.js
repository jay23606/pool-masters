export const emptyPerformance=()=>({breakRuns:0,byTable:{}})
export function recordPerformance(current,{won,breakRun,tableSize}){
 const next={...(current||emptyPerformance()),byTable:{...(current?.byTable||{})}}
 const row={wins:0,losses:0,...next.byTable[tableSize]}
 row[won?'wins':'losses']++
 next.byTable[tableSize]=row
 if(breakRun)next.breakRuns=(next.breakRuns||0)+1
 return next
}
export function tableRecord(performance,size){
 const row=performance?.byTable?.[size]||{wins:0,losses:0}
 const games=row.wins+row.losses
 return {size,wins:row.wins,losses:row.losses,rate:games?Math.round(row.wins/games*100):0}
}
