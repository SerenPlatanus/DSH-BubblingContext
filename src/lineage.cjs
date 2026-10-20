const KEY = 'bubblingContextLineage';
function initLineage(header, inheritedEventCount) {
  return { parentSession:header.parentSession||null, inheritedEventCount, seeded:!!header.isSeeded,
    provider:null, children:[], calls:[], usage:{input:0,output:0,cacheRead:0,cacheWrite:0,total:0,calls:0,cacheReported:false} };
}
function foldLineage(s,e) {
  if(e.seq<s.inheritedEventCount)return s;
  const d=e.data||{};
  if(e.type==='subagent/descriptor')return {...s,provider:d.provider||null};
  if(e.type==='tool/call')return {...s,calls:[...s.calls,{id:d.callId,name:d.name,seq:e.seq,active:true}]};
  if(e.type==='subagent/catalog'){
    if(s.children.some(c=>c.id===d.childId))return s;
    const active=s.calls.filter(c=>c.active&&/subagent|agent.*(spawn|fork)|spawn.*agent|fork.*agent/.test(c.name));
    return {...s,children:[...s.children,{id:d.childId,mode:d.mode||'unknown',label:d.label||d.childId,
      catalogSeq:e.seq,callId:active.length===1?active[0].id:null,callSeq:active.length===1?active[0].seq:null,anchorConfirmed:false}]};
  }
  if(e.type==='tool/result'){
    const callId=d.message?.toolCallId ?? d.message?.callId;
    const call=s.calls.find(c=>c.id===callId);
    const content=JSON.stringify(d.message?.content||[]);
    // Confirm creation ownership from a creation tool's recorded result. Do not
    // claim a listing/inspection tool merely because its result names a child.
    const creation=call&&/^(subagent|subagent_spawn|subagent_fork|spawn_agent|fork_agent)$/.test(call.name);
    return {...s,calls:s.calls.map(c=>c.id===callId?{...c,active:false}:c),children:s.children.map(c=>creation&&content.includes(c.id)?{...c,callId,callSeq:call.seq,anchorConfirmed:true}:c)};
  }
  if(e.type==='assistant/message'&&d.usage){
    const u=d.usage,old=s.usage;
    const n=x=>Number.isFinite(x)&&x>=0?x:0;
    return {...s,usage:{input:old.input+n(u.inputTokens),output:old.output+n(u.outputTokens),
      cacheRead:old.cacheRead+n(u.cacheReadTokens),cacheWrite:old.cacheWrite+n(u.cacheWriteTokens),
      total:old.total+(Number.isFinite(u.totalTokens)?u.totalTokens:n(u.inputTokens)+n(u.cacheReadTokens)+n(u.cacheWriteTokens)+n(u.outputTokens)),
      calls:old.calls+1,cacheReported:old.cacheReported||u.cacheReadTokens!=null}};
  }
  return s;
}
module.exports={KEY,initLineage,foldLineage};
