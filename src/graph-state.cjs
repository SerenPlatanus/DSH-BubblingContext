// Edits are attached to stable node identities, never screen coordinates.
// Walking parent links makes old AND future descendants inherit each edit.
function transformGraph(layout, edits = {}) {
  const parents=new Map(),byId=new Map(layout.points.map(p=>[p.id,p]));
  const lanes=layout.lanes||[{id:'main',points:layout.points}];
  for(const lane of lanes)for(let i=0;i<lane.points.length;i++)parents.set(lane.points[i].id,i?lane.points[i-1].id:lane.parentNodeId||null);
  const memo=new Map(),visiting=new Set();
  function offset(id){if(memo.has(id))return memo.get(id);if(visiting.has(id))return{x:0,y:0};visiting.add(id);
    const parent=parents.get(id),above=parent&&byId.has(parent)?offset(parent):{x:0,y:0},own=edits[id]||{};
    const result={x:above.x+(Number.isFinite(own.x)?own.x:0),y:above.y+(Number.isFinite(own.y)?own.y:0)};
    visiting.delete(id);memo.set(id,result);return result;}
  const points=layout.points.map(p=>{const d=offset(p.id);return{...p,x:p.x+d.x,y:p.y+d.y,cardX:p.cardX+d.x};});
  const mapped=new Map(points.map(p=>[p.id,p]));
  return {...layout,points,lanes:lanes.map(l=>{const first=l.points[0],d=first?offset(first.id):{x:0,y:0};return{...l,x:(l.x||0)+d.x,y:(l.y||0)+d.y,points:l.points.map(p=>mapped.get(p.id))};}),
    links:(layout.links||[]).map(l=>({...l,from:mapped.get(l.from.id),to:mapped.get(l.to.id)}))};
}
function collapseGraph(layout, collapsed={}){
  if(!layout.lanes)return layout;
  const lanesById=new Map(layout.lanes.map(l=>[l.id,l]));
  function hidden(l){const seen=new Set();let parent=l.parentId==='root'?'main':l.parentId;
    while(parent&&parent!=='main'&&!seen.has(parent)){if(collapsed[parent])return true;seen.add(parent);const p=lanesById.get(parent);parent=p?.parentId==='root'?'main':p?.parentId;}return false;}
  const replacement=new Map();
  const lanes=layout.lanes.filter(l=>!hidden(l)).map(l=>{
    if(l.id==='main'||!collapsed[l.id]||!l.points.length)return l;
    const first=l.points[0],u=l.meta?.usage;
    const summary={...first,id:`agent-summary:${l.id}`,dragId:first.id,kind:'context',title:`${l.isFork?'Fork':'子 Agent'} · ${l.label}（已折叠）`,text:`${l.points.length} 个节点\n输入 ${u?.input??'未报告'} · 输出 ${u?.output??'未报告'}\n调用合计 ${u?.total??'未报告'} tokens`,tokens:l.points.reduce((s,p)=>s+p.tokens,0),estimated:true,source:{agentId:l.id,usage:u},collapsedAgentId:l.id};
    replacement.set(first.id,summary);return{...l,collapsed:true,points:[summary]};});
  const ids=new Set(lanes.flatMap(l=>l.points.map(p=>p.id)));
  const links=(layout.links||[]).map(l=>({...l,from:replacement.get(l.from.id)||l.from,to:replacement.get(l.to.id)||l.to})).filter(l=>ids.has(l.from.id)&&ids.has(l.to.id));
  return{...layout,lanes,points:lanes.flatMap(l=>l.points),links};
}
module.exports={transformGraph,collapseGraph};
