export const emptyPerformance=()=>({breakRuns:0,byTable:{}})
export function recordPerformance(current,{won,breakRun,tableSize}){
 const next={...(current||emptyPerformance()),byTable:{...(current?.byTable||{})}}
 const row={wins:0,losses:0,...next.byTable[tableSize]}
 row[won?'wins':'losses']++
 next.byTable[tableSize]=row
 if(breakRun)next.breakRuns=(next.breakRuns||0)+1
 return next
}
