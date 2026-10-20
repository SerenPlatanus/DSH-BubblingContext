const {test}=require('node:test');
const a=require('node:assert/strict');
const {initLineage,foldLineage,KEY}=require('../src/lineage.cjs');
const {branchLayout,watchBranches}=require('../src/branches.cjs');
const {graphLayout}=require('../src/trajectory.cjs');
const ev=(seq,type,data)=>({seq,type,data});
test('exact fork boundary excludes inherited usage and inherited child catalogs',()=>{
 let s=initLineage({isSeeded:true,parentSession:'parent'},10);
 a.equal(foldLineage(s,ev(3,'subagent/catalog',{childId:'ancestor'})),s);
 a.equal(foldLineage(s,ev(5,'assistant/message',{usage:{inputTokens:90,outputTokens:20}})),s);
 s=foldLineage(s,ev(10,'subagent/descriptor',{provider:'fork'}));
 s=foldLineage(s,ev(11,'assistant/message',{usage:{inputTokens:4,outputTokens:3,cacheReadTokens:8,totalTokens:15}}));
 a.equal(s.provider,'fork');a.equal(s.usage.total,15);a.equal(s.usage.cacheRead,8);a.equal(s.usage.calls,1);
});
test('parallel creation is not arbitrarily assigned; tool receipt confirms child ownership',()=>{
 let s=initLineage({isSeeded:false},0);
 for(const id of ['a','b'])s=foldLineage(s,ev(1,'tool/call',{callId:id,name:'subagent_spawn'}));
 s=foldLineage(s,ev(2,'subagent/catalog',{childId:'child',mode:'continuable'}));
 a.equal(s.children[0].callId,null);
 s=foldLineage(s,ev(3,'tool/result',{message:{toolCallId:'b',content:[{text:'started subagent child'}]}}));
 a.equal(s.children[0].callId,'b');a.equal(s.children[0].anchorConfirmed,true);
});
test('real DSH ordinary subagent receipts anchor fresh children independently from fork',()=>{
 let s=initLineage({isSeeded:false},0);
 s=foldLineage(s,ev(760,'tool/call',{callId:'spawn-call',name:'subagent'}));
 s=foldLineage(s,ev(761,'tool/call',{callId:'fork-call',name:'subagent_fork'}));
 s=foldLineage(s,ev(762,'subagent/catalog',{childId:'fresh',mode:'continuable',label:'fresh'}));
 s=foldLineage(s,ev(763,'tool/result',{message:{role:'tool',toolCallId:'spawn-call',content:[{type:'text',text:'started subagent fresh'}],isError:false}}));
 s=foldLineage(s,ev(764,'subagent/catalog',{childId:'fork',mode:'continuable',label:'fork'}));
 s=foldLineage(s,ev(765,'tool/result',{message:{role:'tool',toolCallId:'fork-call',content:[{type:'text',text:'started subagent fork'}],isError:false}}));
 a.equal(s.children[0].callId,'spawn-call');a.equal(s.children[0].callSeq,760);a.equal(s.children[0].anchorConfirmed,true);
 a.equal(s.children[1].callId,'fork-call');a.equal(s.children[1].anchorConfirmed,true);
 a.ok(s.calls.every(c=>!c.active));
});
const node=(id,seq,kind='tool')=>({id,seq,kind,tokens:10,cumulative:10,color:'#aaa',title:id,text:''});
test('fresh lane starts independently at creation tool; fork joins exact inherited cut and omits seed',()=>{
 const main=[node('system:0',0,'system'),node('user:2',2,'user'),node('tool:create',8)];
 const children=[{id:'fresh',parentId:'root',label:'fresh',anchor:{callId:'create',anchorConfirmed:true},meta:{seeded:false,inheritedEventCount:0},nodes:[node('system:0',0,'system'),node('a',1)]},
 {id:'fork',parentId:'root',label:'fork',anchor:{callId:'create',anchorConfirmed:true},meta:{seeded:true,inheritedEventCount:3},nodes:[node('system:0',0,'system'),node('user:2',2,'user'),node('own',5)]}];
 const result=branchLayout(main,children,420,graphLayout);
 a.equal(result.lanes.length,3);a.equal(result.links.filter(l=>l.kind==='fork').length,1);
 const forkLink=result.links.find(l=>l.kind==='fork');a.equal(forkLink.from.localId,'user:2');a.equal(forkLink.to.localId,'own');
 a.equal(result.links.filter(l=>l.kind==='creation').length,2);
 a.equal(result.lanes[1].points[0].y,result.lanes[0].points[2].y);
 a.equal(result.lanes[2].points.length,1);a.equal(result.lanes[2].inheritTokens,20);
 a.ok(result.lanes[2].points[0].x>result.lanes[1].points[0].x);
});
test('missing fork cut stays explicitly unresolved instead of attaching to an invented ancestor',()=>{
 const r=branchLayout([node('tool:create',20)],[{id:'f',parentId:'root',label:'f',anchor:{callId:'create'},meta:{seeded:true,inheritedEventCount:3},nodes:[node('own',5)]}],400,graphLayout);
 a.equal(r.links.filter(l=>l.kind==='fork').length,0);a.ok(r.unresolved.some(t=>t.includes('切点')));
});
function source(value){const callbacks=new Set();return{getSnapshot:()=>value,subscribe:f=>(callbacks.add(f),()=>callbacks.delete(f)),set:v=>{value=v;for(const f of callbacks)f();},callbacks};}
test('child subscriptions update live and every retained reference is released',async()=>{
 let releases=0,last;
 const rootMeta=source({...initLineage({isSeeded:false},0),children:[{id:'child',mode:'continuable',label:'test',callId:'x'}]});
 const childMeta=source(initLineage({isSeeded:false},0)),rootTarget=source([]),childTarget=source([node('system:0',0,'system')]);
 const binding=meta=>({session:{projections:{faceOf:key=>(a.equal(key,KEY),meta)},getSnapshot:()=>({hasMore:false}),subscribe:()=>()=>{}}});
 const rb=binding(rootMeta),cb=binding(childMeta);
 const ctx={sessions:{binding:()=>rb,retain:()=>({binding:cb,ready:Promise.resolve(),release(){releases++;}})},uiConversation:{binding:id=>({target:()=>id==='root'?rootTarget:childTarget})}};
 const stop=watchBranches(ctx,'root',v=>last=v,s=>s);
 await new Promise(r=>setImmediate(r));a.equal(last.branches.length,1);a.equal(last.ready,true);
 childTarget.set([node('system:0',0,'system'),node('a',2,'assistant')]);a.equal(last.branches[0].nodes.length,2);
 stop();a.equal(releases,1);a.equal(childTarget.callbacks.size,0);a.equal(childMeta.callbacks.size,0);a.equal(rootMeta.callbacks.size,0);
});
