const {test}=require('node:test'),a=require('node:assert/strict');
const {transformGraph,collapseGraph}=require('../src/graph-state.cjs');
const {branchLayout}=require('../src/branches.cjs'),{graphLayout}=require('../src/trajectory.cjs');
const {createContextRegistry,mergeContexts}=require('../src/context-source.cjs');
const n=(id,seq,kind='tool')=>({id,seq,kind,title:id,text:'text',tokens:4,cumulative:4,color:'#aaa'});
const main=[n('system:0',0,'system'),n('tool:spawn',2),n('tail',4)];
const child={id:'child',parentId:'root',label:'child',anchor:{callId:'spawn',anchorConfirmed:true},meta:{seeded:false,inheritedEventCount:0,usage:{total:20}},nodes:[n('c0',0,'system'),n('tool:grand',2),n('c2',4)]};
const grand={id:'grand',parentId:'child',label:'grand',anchor:{callId:'grand',anchorConfirmed:true},meta:{seeded:false,inheritedEventCount:0},nodes:[n('g0',0,'system')]};
test('drag offsets flow into downstream and nested branches, but not ancestors',()=>{
 const base=branchLayout(main,[child,grand],420,graphLayout),moved=transformGraph(base,{'tool:spawn':{x:70,y:90}});
 const before=new Map(base.points.map(p=>[p.id,p]));
 for(const p of moved.points){const old=before.get(p.id),affected=p.id!=='system:0';a.equal(p.x-old.x,affected?70:0);a.equal(p.y-old.y,affected?90:0);a.equal(p.cardX-old.cardX,affected?70:0);}
 a.ok(moved.links.every(l=>l.kind==='creation'));a.equal(moved.links.length,2);
});
test('new suffix nodes inherit existing edits and child-local edits compose',()=>{
 const edits={'tool:spawn':{x:30,y:40},'child:c0':{x:-5,y:8}};
 const base=branchLayout(main,[child],420,graphLayout),moved=transformGraph(base,edits);
 const expanded=branchLayout([...main,n('new-main',6)],[{...child,nodes:[...child.nodes,n('new-child',6)]}],420,graphLayout),next=transformGraph(expanded,edits);
 for(const p of moved.points){const q=next.points.find(q=>q.id===p.id);a.equal(q.x,p.x);a.equal(q.y,p.y);}
 const m=next.points.find(p=>p.id==='new-main'),c=next.points.find(p=>p.id==='child:new-child');
 a.equal(m.x,expanded.points.find(p=>p.id===m.id).x+30);a.equal(c.x,expanded.points.find(p=>p.id===c.id).x+25);
});
test('folded groups hide descendants, retain summary and yellow creation edge',()=>{
 const moved=transformGraph(branchLayout(main,[child,grand],420,graphLayout),{'child:c0':{x:20,y:40}});
 const folded=collapseGraph(moved,{child:true});
 a.equal(folded.lanes.length,2);a.equal(folded.lanes[1].points.length,1);
 const summary=folded.lanes[1].points[0];a.equal(summary.collapsedAgentId,'child');a.equal(summary.dragId,'child:c0');
 a.equal(folded.links.length,1);a.equal(folded.links[0].kind,'creation');a.equal(folded.links[0].to.id,summary.id);
 const reopened=collapseGraph(moved,{});a.equal(reopened.points.length,moved.points.length);a.equal(reopened.points.find(p=>p.id==='child:c0').x,summary.x);
});
test('context adapter validates, merges after stable anchor, updates, unsubscribes',()=>{
 const registry=createContextRegistry();let records=[{id:'r',afterNodeId:'tool:spawn',content:'injected',title:'summary',tokens:7}],changed,notices=0,disposed=0;
 registry.subscribe('s',()=>notices++);
 const off=registry.registerSource({version:1,id:'memory',sessionId:'s',getSnapshot:()=>records,subscribe:fn=>(changed=fn,()=>disposed++)});
 const merged=mergeContexts(main,registry.getSnapshot('s'),()=>99);
 a.equal(merged[2].id,'custom:memory:r');a.equal(merged[2].tokens,7);a.equal(merged[2].estimated,false);a.equal(merged.at(-1).cumulative,19);
 records=[{id:'r',afterNodeId:'tool:spawn',content:'update'}];changed();a.equal(registry.getSnapshot('s')[0].content,'update');
 records=[{id:'bad',content:'no anchor'}];changed();a.ok(registry.getSnapshot('s')[0].error);
 a.throws(()=>registry.registerSource({version:1,id:'memory',sessionId:'s',getSnapshot:()=>[],subscribe:()=>()=>{}}));
 off();a.equal(disposed,1);a.equal(registry.getSnapshot('s').length,0);a.ok(notices>=4);registry.dispose();
});
