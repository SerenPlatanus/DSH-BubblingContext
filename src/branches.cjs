const LINEAGE_KEY='bubblingContextLineage';
// Retains read-only child sessions; owns and releases every listener/reference.
function watchBranches(ctx,rootId,publish,buildNodes,contextSources){
  let stopped=false;
  const entries=new Map(), pending=new Map(), errors=new Map(), retries=new Map(),retryTimers=new Set();
  let emitTimer=null,published=false;
  function publishNow(){emitTimer=null;if(!stopped){published=true;publish({ready:!!entries.get(rootId)?.meta,mainMeta:entries.get(rootId)?.meta,branches:[...entries.values()].filter(e=>e.id!==rootId).map(e=>({id:e.id,parentId:e.parentId,label:e.label,anchor:e.anchor,meta:e.meta,nodes:e.nodes,running:e.binding.session.getSnapshot().running,hasMore:e.binding.session.getSnapshot().hasMore})),errors:[...errors.values()]});}}
  function emit(immediate=false){if(stopped)return;if(immediate===true||!published){clearTimeout(emitTimer);publishNow();}else if(emitTimer==null)emitTimer=setTimeout(publishNow,32);}
  function retry(child,refresh,error){errors.set(child.id,`${child.label}: ${error.message}`);const count=retries.get(child.id)||0;if(count>=3)return;retries.set(child.id,count+1);const timer=setTimeout(()=>{retryTimers.delete(timer);if(stopped)return;errors.delete(child.id);refresh();},250*2**count);retryTimers.add(timer);}
  function attach(id,binding,parentId,label,anchor,reference){
    if(stopped){reference?.release();return;}
    const row={id,binding,parentId,label,anchor,reference,nodes:[],meta:null,cleanups:[]};entries.set(id,row);
    const metaSource=binding.session.projections.faceOf(LINEAGE_KEY);
    const target=ctx.uiConversation.binding(id).target('trajectory');
    function refresh(){
      if(stopped)return;
      row.meta=metaSource.getSnapshot()||null;
      const snapshot=target.getSnapshot();
      if(row.snapshot!==snapshot){row.nodes=id===rootId?[]:buildNodes(snapshot,id);row.snapshot=snapshot;}
      const children=row.meta?.children||[];
      for(const child of children){
        const existing=entries.get(child.id);
        if(existing){existing.anchor=child;existing.label=child.label;continue;}
        if(pending.has(child.id)||errors.has(child.id)||child.id===rootId)continue;
        let ref;
        try{ref=ctx.sessions.retain({parentSessionId:id,childSessionId:child.id,mode:child.mode},{source:'controllerOperation'});}
        catch(e){retry(child,refresh,e);continue;}
        pending.set(child.id,ref);
        ref.ready.then(()=>{pending.delete(child.id);if(stopped)return;errors.delete(child.id);retries.delete(child.id);attach(child.id,ref.binding,id,child.label,child,ref);emit(true);}).catch(e=>{pending.delete(child.id);if(stopped)return;ref.release();retry(child,refresh,e);emit();});
      }
      emit();
    }
    row.cleanups.push(metaSource.subscribe(refresh),target.subscribe(refresh),binding.session.subscribe(emit));
    if(contextSources)row.cleanups.push(contextSources.subscribe(id,()=>{row.snapshot=null;refresh();}));
    refresh();
  }
  const root=ctx.sessions.binding(rootId);
  if(root)attach(rootId,root,null,'主 Agent',null,null);
  else publish({branches:[],errors:['主会话尚未就绪']});
  return ()=>{stopped=true;clearTimeout(emitTimer);for(const timer of retryTimers)clearTimeout(timer);for(const row of entries.values()){for(const off of row.cleanups)off();row.reference?.release();}for(const ref of pending.values())ref.release();entries.clear();};
}

function branchLayout(mainNodes,branches,width,graphLayout){
  const laneWidth=Math.max(310,Math.min(380,width));
  const main=graphLayout(mainNodes,laneWidth,'straight').points.map((n,i)=>({...n,localId:n.id,agentId:'main',x:36,y:66+i*56,cardX:73,cardWidth:laneWidth-85}));
  const lanes=[{id:'main',label:'主 Agent',x:0,y:30,points:main}], links=[], unresolved=[];
  const byAgent=new Map([['main',lanes[0]]]);
  const pending=[...branches];
  for(let pass=0;pending.length&&pass<=branches.length;pass++)for(let i=0;i<pending.length;){
    const b=pending[i],parent=byAgent.get(b.parentId==='root'?'main':b.parentId);
    if(!parent){i++;continue;}pending.splice(i,1);
    const x=lanes.length*laneWidth;
    const inherited=b.meta?.inheritedEventCount;
    const isFork=b.meta?b.meta.seeded:null;
    const own=inherited==null?[]:b.nodes.filter(n=>n.seq>=inherited);
    const tool=parent.points.find(n=>n.localId===`tool:${b.anchor?.callId}`);
    const cut=isFork?parent.points.filter(n=>n.seq<inherited).at(-1):null;
    const anchor=tool||cut;
    const firstY=anchor?anchor.y:66;
    const points=graphLayout(own,laneWidth,'straight').points.map((n,j)=>({...n,id:`${b.id}:${n.id}`,localId:n.id,agentId:b.id,x:x+36,y:firstY+j*56,cardX:x+73,cardWidth:laneWidth-85}));
    const lane={...b,x,y:Math.max(20,firstY-30),points,isFork,parentNodeId:(tool||cut)?.id||null,inheritTokens:isFork?b.nodes.filter(n=>n.seq<inherited).reduce((s,n)=>s+n.tokens,0):0};
    lanes.push(lane);byAgent.set(b.id,lane);
    if(isFork&&cut&&points.length)links.push({from:cut,to:points[0],kind:'fork'});
    if(tool&&points.length)links.push({from:tool,to:points[0],kind:'creation'});
    if(isFork&&!cut)unresolved.push(`${b.label}：Fork 切点不在已加载父历史中`);
    if(!tool)unresolved.push(`${b.label}：创建工具定位${b.anchor?.callId?'尚未加载':'不明确'}`);
    else if(!b.anchor?.anchorConfirmed)unresolved.push(`${b.label}：创建工具关联待结果确认`);
  }
  return {points:lanes.flatMap(l=>l.points),lanes,links,unresolved,height:Math.max(140,...lanes.map(l=>l.points.at(-1)?.y+50||l.y+100)),width:lanes.length*laneWidth};
}
module.exports={watchBranches,branchLayout,LINEAGE_KEY};
