// Versioned visualization-only input for future context-management plugins.
// Registering records DOES NOT inject them into a model request.
function createContextRegistry(){
  const sources=new Map(),cache=new Map(),listeners=new Map();
  function changed(sessionId){cache.delete(sessionId);for(const fn of listeners.get(sessionId)||[])fn();}
  function validate(records){if(!Array.isArray(records))throw new TypeError('Context source snapshot must be an array');const ids=new Set();
    return records.map(r=>{if(!r||typeof r.id!=='string'||!r.id||ids.has(r.id)||typeof r.content!=='string'||typeof r.afterNodeId!=='string')throw new TypeError('Context record needs unique id, content, afterNodeId');ids.add(r.id);
      if(r.tokens!=null&&(!Number.isFinite(r.tokens)||r.tokens<0))throw new TypeError('tokens must be nonnegative');return{...r};});}
  return{
    registerSource(source){if(!source?.id||!source.sessionId||source.version!==1||typeof source.subscribe!=='function'||typeof source.getSnapshot!=='function')throw new TypeError('Invalid v1 context source');
      const key=`${source.sessionId}:${source.id}`;if(sources.has(key))throw new Error('Duplicate context source');
      const row={source,records:validate(source.getSnapshot()),error:null,off:null};sources.set(key,row);
      try{row.off=source.subscribe(()=>{try{row.records=validate(source.getSnapshot());row.error=null;}catch(e){row.error=e.message;}changed(source.sessionId);});}catch(e){sources.delete(key);throw e;}
      changed(source.sessionId);let active=true;return()=>{if(!active)return;active=false;row.off?.();sources.delete(key);changed(source.sessionId);};},
    subscribe(sessionId,fn){let set=listeners.get(sessionId);if(!set)listeners.set(sessionId,set=new Set());set.add(fn);return()=>{set.delete(fn);if(!set.size)listeners.delete(sessionId);};},
    getSnapshot(sessionId){if(!cache.has(sessionId))cache.set(sessionId,[...sources.values()].filter(r=>r.source.sessionId===sessionId).flatMap(r=>r.error?[{sourceId:r.source.id,error:r.error}]:r.records.map(record=>({...record,sourceId:r.source.id}))));return cache.get(sessionId);},
    dispose(){for(const r of sources.values())r.off?.();sources.clear();cache.clear();for(const set of listeners.values())for(const fn of set)fn();listeners.clear();}
  };
}
function mergeContexts(nodes,records,estimateTokens){
  const after=new Map();for(const r of records){if(r.error)continue;const list=after.get(r.afterNodeId)||[];list.push(r);after.set(r.afterNodeId,list);}
  const result=[];let cumulative=0;
  for(const node of nodes){cumulative+=node.tokens;result.push({...node,cumulative});for(const r of after.get(node.id)||[]){
    const tokens=r.tokens??estimateTokens(r.content);cumulative+=tokens;
    result.push({id:`custom:${r.sourceId}:${r.id}`,seq:node.seq,kind:'context',color:'#4caf79',title:r.title||'自定义上下文',text:r.content,tokens,estimated:r.tokens==null,cumulative,source:r,custom:true});}}
  return result;
}
module.exports={createContextRegistry,mergeContexts};
