const React = require('react');
const trajectory = require('./trajectory.cjs');
const branchTools = require('./branches.cjs');
const graphState = require('./graph-state.cjs');
const rendering = require('./render-window.cjs');
const {createContextRegistry,mergeContexts} = require('./context-source.cjs');
const h = React.createElement;
const { useState, useEffect, useMemo, useRef } = React;
const { COLORS, LABELS, buildNodes, graphLayout, stringify } = trajectory;
const ID = 'dsh-bubbling-context';
const KIND = 'bubbling-context';
const fmt = n => n == null ? '未报告' : n.toLocaleString();
function BubbleIcon({ size = 20 } = {}) {
  return h('svg', { width:size, height:size, viewBox:'0 0 24 24', fill:'none', stroke:'currentColor', strokeWidth:1.6, 'aria-hidden':true }, h('circle',{cx:9,cy:9,r:5.5}),h('circle',{cx:17,cy:16,r:4}),h('circle',{cx:6,cy:19,r:1.5}));
}
const css = `
.bc-node .bc-frame{fill:transparent;stroke-width:.8;stroke-opacity:.5;pointer-events:all}.bc-node:hover .bc-frame,.bc-node[aria-pressed=true] .bc-frame,.bc-node:focus-visible .bc-frame{stroke-opacity:1;stroke-width:1.5}.bc-node:hover .bc-bubble{fill-opacity:1;filter:none}.bc-node .bc-wave{animation:bcDotPulse .22s ease-in-out both}.bc-canvas .bc-wire-wave{stroke-dasharray:1;animation:bcTravel .18s linear both}
@keyframes bcDotPulse{0%,100%{stroke-width:1;stroke:#ffffff40}50%{stroke:#fff;stroke-width:4}}
@keyframes bcTravel{0%{stroke-dashoffset:1;stroke-opacity:0}15%{stroke-opacity:1}85%{stroke-opacity:1}100%{stroke-dashoffset:0;stroke-opacity:0}}
.bc-node:focus-visible .bc-bubble,.bc-node[aria-pressed=true] .bc-bubble{stroke:#fff;stroke-width:2}.bc-node:hover .bc-bubble{fill-opacity:.4}
.bc-trigger{display:inline-flex;align-items:center;justify-content:center;width:30px;height:28px;padding:0;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-label-secondary,#aaa);cursor:pointer;flex:none}
.bc-trigger:hover,.bc-button:hover{background:#ffffff12;color:var(--dsw-alias-label-primary,#eee)}.bc-trigger:focus-visible,.bc-button:focus-visible{outline:2px solid #8bb5ff;outline-offset:2px}
.bc-panel{box-sizing:border-box;display:flex;flex-direction:column;height:100%;min-height:240px;color:var(--dsw-alias-label-primary,#ddd);font-family:inherit;overflow:hidden}.bc-heading{display:flex;align-items:center;gap:9px;padding:12px 16px;border-bottom:1px solid #ffffff16;flex:none}.bc-heading h2{font-size:14px;font-weight:600;margin:0;flex:1}
.bc-button{border:1px solid #ffffff20;background:transparent;color:inherit;border-radius:6px;cursor:pointer;padding:4px 8px;font:inherit;font-size:12px}.bc-button:disabled{opacity:.45;cursor:default}
.bc-legend{display:flex;flex-wrap:wrap;gap:7px 12px;padding:10px 16px;font-size:11px;color:var(--dsw-alias-label-secondary,#aaa);flex:none}.bc-legend span{display:inline-flex;align-items:center;gap:5px}.bc-dot{width:8px;height:8px;border-radius:50%;display:inline-block}
.bc-status{display:flex;gap:10px;align-items:center;padding:0 16px 10px;font-size:11px;color:var(--dsw-alias-label-secondary,#999);flex:none}.bc-live{color:#72cb98}.bc-status .bc-button{margin-left:auto}
.bc-canvas{flex:1;min-height:120px;overflow:auto;scrollbar-width:thin;background-image:radial-gradient(#ffffff0d 1px,transparent 1px);background-size:20px 20px}.bc-canvas svg{display:block;min-width:260px;width:100%}.bc-link{stroke:#fff;stroke-opacity:.35;stroke-width:1.4;fill:none}.bc-node{cursor:pointer;outline:none}.bc-node:focus-visible circle,.bc-node[aria-pressed=true] circle{stroke:#fff;stroke-width:3}.bc-node:hover circle{filter:brightness(1.35)}.bc-node text{fill:var(--dsw-alias-label-secondary,#aaa);font-size:9px;text-anchor:middle;pointer-events:none}.bc-node .bc-symbol{fill:#fff;font-size:12px;font-weight:600}.bc-node .bc-title{fill:var(--dsw-alias-label-primary,#ddd);font-size:10px}.bc-bubble{stroke:#ffffff40;stroke-width:1}
.bc-new .bc-bubble{animation:bcBirth .46s cubic-bezier(.2,1.6,.4,1) both;transform-box:fill-box;transform-origin:center}.bc-wave{animation:bcGlow .28s ease-in-out both;transform-box:fill-box;transform-origin:center}.bc-wire-wave{stroke:#fff;stroke-width:2.8;animation:bcWire .3s ease-in-out both;stroke-opacity:0;fill:none}
@keyframes bcBirth{0%{transform:scale(.05);opacity:0}75%{transform:scale(1.16);opacity:1}100%{transform:scale(1)}}@keyframes bcGlow{0%,100%{filter:brightness(1);stroke-width:1}50%{filter:brightness(1.9) drop-shadow(0 0 9px #ffffffaa);stroke:#fff;stroke-width:3}}@keyframes bcWire{0%,100%{stroke-opacity:0}45%{stroke-opacity:1}}
.bc-empty{padding:48px 24px;text-align:center;font-size:13px;line-height:1.8;color:#999}.bc-empty strong{color:#ccc;display:block;font-size:15px;margin-bottom:8px}.bc-details{flex:none;max-height:44%;overflow:auto;padding:12px 16px;border-top:1px solid #ffffff24;background:var(--dsw-alias-background-default,#202020);font-size:12px}.bc-details-header{display:flex;align-items:center;gap:8px}.bc-details-header strong{flex:1}.bc-details p{margin:8px 0;line-height:1.7;color:var(--dsw-alias-label-secondary,#aaa)}.bc-details pre{white-space:pre-wrap;overflow-wrap:anywhere;font:11px/1.7 ui-monospace,monospace;background:#0002;padding:10px;border-radius:8px;max-height:300px;overflow:auto}.bc-details summary{cursor:pointer;padding:6px 0}.bc-footer{flex:none;font-size:10px;line-height:1.6;color:var(--dsw-alias-label-secondary,#999);padding:8px 16px;border-top:1px solid #ffffff16}.bc-error{color:#f09588;padding:8px 16px;font-size:12px}
@media(prefers-reduced-motion:reduce){.bc-wave,.bc-wire-wave,.bc-new .bc-bubble{animation:none!important}}
`;

function useEvolution(nodes, requestKey, reduced) {
  const [visible,setVisible] = useState(() => new Set(nodes.map(n=>n.id)));
  const [wave,setWave] = useState(null);
  const [epoch,setEpoch] = useState(0);
  const known=useRef(new Set(nodes.map(n=>n.id))), initialized=useRef(nodes.length>0), lastRequest=useRef(requestKey);
  const timer=useRef(null), busy=useRef(false), latest=useRef(nodes), born=useRef(new Set());
  const seenAgents=useRef(new Set(nodes.map(n=>n.agentId||'main')));
  latest.current=nodes;
  const identity=nodes.map(n=>n.id).join('|');
  useEffect(()=>{
    if(!initialized.current && nodes.length){initialized.current=true;known.current=new Set(nodes.map(n=>n.id));seenAgents.current=new Set(nodes.map(n=>n.agentId||'main'));setVisible(new Set(known.current));lastRequest.current=requestKey;return;}
    const newAgents=new Set(nodes.map(n=>n.agentId||'main').filter(id=>!seenAgents.current.has(id)));
    if(newAgents.size){for(const n of nodes)if(newAgents.has(n.agentId||'main'))known.current.add(n.id);for(const id of newAgents)seenAgents.current.add(id);setVisible(new Set(known.current));}
    // Paging backwards reveals older history directly; it is not a new call.
    const firstKnown=new Map();for(const n of nodes)if(known.current.has(n.id)&&!firstKnown.has(n.agentId||'main'))firstKnown.set(n.agentId||'main',n);
    const older=nodes.filter(n=>!known.current.has(n.id)&&firstKnown.has(n.agentId||'main')&&n.seq<firstKnown.get(n.agentId||'main').seq);
    if(older.length){for(const n of older)known.current.add(n.id);setVisible(new Set(known.current));}
    const fresh=nodes.filter(n=>!known.current.has(n.id));
    const changed=lastRequest.current!==requestKey;lastRequest.current=requestKey;
    if((!fresh.length&&!changed)||busy.current)return;
    if(reduced){known.current=new Set(nodes.map(n=>n.id));setVisible(new Set(known.current));return;}
    busy.current=true;born.current=new Set();
    const ids=nodes.filter(n=>known.current.has(n.id)).map(n=>n.id);
    const duration=ids.length?Math.min(1100,Math.max(360,ids.length*24)):0;
    setWave({ids,duration,stamp:Date.now()});
    timer.current=setTimeout(()=>{
      const additions=latest.current.filter(n=>!known.current.has(n.id));born.current=new Set(additions.map(n=>n.id));
      let cursor=0;
      function reveal(){const end=Math.min(additions.length,cursor+32);while(cursor<end)known.current.add(additions[cursor++].id);setVisible(new Set(known.current));
        if(cursor<additions.length)timer.current=setTimeout(reveal,16);
        else{busy.current=false;setWave(null);setEpoch(e=>e+1);}}
      reveal();
    },duration+(ids.length?180:0));
  },[identity,requestKey,reduced,epoch]);
  useEffect(()=>()=>clearTimeout(timer.current),[]);
  return {visible,wave,born:born.current};
}
function Details({node,onClose}){
  if(!node)return null;
  const u=node.usage;
  return h('aside',{className:'bc-details','aria-label':'节点详情'},
    h('div',{className:'bc-details-header'},h('i',{className:'bc-dot',style:{background:node.color}}),h('strong',null,node.title),h('button',{className:'bc-button',onClick:onClose,'aria-label':'关闭节点详情'},'×')),
    h('p',null,`本节点 ${node.estimated?'≈ ':''}${fmt(node.tokens)} tokens · 已加载轨迹累计 ≈ ${fmt(node.cumulative)} tokens`),
    u&&h('p',null,`本次调用：输入 ${fmt(u.input)} · 实际缓存读取 ${fmt(u.cacheRead)} · 缓存写入 ${fmt(u.cacheWrite)} · 输出 ${fmt(u.output)}`),
    node.checkpoint&&h('p',null,'压缩检查点：此前历史可能已被摘要替换，累计量不代表当前模型窗口。'),
    node.status&&h('p',null,`状态：${node.status}`),
    node.nonContext&&h('p',null,'状态/控制事件，不计入上下文内容累计 Token。'),
    node.text.includes('Token 未估算')&&h('p',null,'包含非文本内容：图片等的 Token 未计入文本估算。'),
    node.checkpoint&&h('p',null,`已替换 ${fmt(node.shadowedItemCount)} 条内容 · 宿主报告替换量 ${fmt(node.shadowedTokenCount)} tokens`),
    h('pre',null,node.text||(node.status==='running'?'等待模型输出…':'无文本内容')),
    node.extra&&h('details',null,h('summary',null,'查看工具定义'),h('pre',null,stringify(node.extra))),
    h('details',null,h('summary',null,`原始轨迹记录 · seq ${node.seq}`),h('pre',null,stringify(node.source))));
}
function LiveGraph({sourceSnapshot:snapshot,sourceSession:session,sessionId,close,loadOlder,branchContext,contextSources,active=true}){
  const held=useRef({});
  const customRecords=React.useSyncExternalStore(fn=>active?contextSources.subscribe(sessionId,fn):()=>{},()=>{if(active||!held.current.custom)held.current.custom=contextSources.getSnapshot(sessionId);return held.current.custom;});
  const baseNodes=useMemo(()=>buildNodes(snapshot),[snapshot]);
  const nodes=useMemo(()=>mergeContexts(baseNodes,customRecords,trajectory.estimateTokens),[baseNodes,customRecords]);
  const [selected,select]=useState(null),[width,setWidth]=useState(420),[error,setError]=useState('');
  const cameraRef=useRef({x:0,y:0,scale:1}),drag=useRef(null),cameraStage=useRef(null),zoomLabel=useRef(null),cameraFrame=useRef(null);
  const camera=cameraRef.current;
  const viewportSize=useRef({width:420,height:600});
  const [renderWindow,setRenderWindow]=useState(()=>rendering.windowFor(camera,420,600));
  const renderWindowRef=useRef(renderWindow);renderWindowRef.current=renderWindow;
  function refreshWindow(force=false){const size=viewportSize.current,c=cameraRef.current;if(force||!rendering.contains(renderWindowRef.current,c,size.width,size.height)){const next=rendering.windowFor(c,size.width,size.height);renderWindowRef.current=next;setRenderWindow(next);}}
  const [dragging,setDragging]=useState(false);
  const preferenceKey=`bubbling-context.graph:${sessionId}`;
  const [edits,setEdits]=useState(()=>{try{return JSON.parse(window.localStorage?.getItem(preferenceKey)||'{}').edits||{};}catch{return{};}});
  const [collapsed,setCollapsed]=useState(()=>{try{return JSON.parse(window.localStorage?.getItem(preferenceKey)||'{}').collapsed||{};}catch{return{};}});
  const editsRef=useRef(edits);editsRef.current=edits;
  const savedPreferences=useRef({edits,collapsed});savedPreferences.current={edits,collapsed};
  useEffect(()=>()=>{try{window.localStorage?.setItem(preferenceKey,JSON.stringify(savedPreferences.current));}catch{}},[preferenceKey]);
  useEffect(()=>{if(dragging)return;const timer=setTimeout(()=>{try{window.localStorage?.setItem(preferenceKey,JSON.stringify({edits,collapsed}));}catch{}},150);return()=>clearTimeout(timer);},[edits,collapsed,preferenceKey,dragging]);
  function toggleAgent(id){setCollapsed(value=>({...value,[id]:!value[id]}));}
  // Camera motion must never reconcile the full SVG tree. Coalesce wheel and
  // pan input into one compositor transform per animation frame instead.
  function paintCamera(){
    cameraFrame.current=null;const value=cameraRef.current;
    if(cameraStage.current)cameraStage.current.style.transform=`translate3d(${value.x}px, ${value.y}px, 0) scale(${value.scale})`;
    if(zoomLabel.current)zoomLabel.current.textContent=`${Math.round(value.scale*100)}%`;
    refreshWindow();
  }
  function updateCamera(value){
    cameraRef.current=value;
    if(cameraFrame.current==null)cameraFrame.current=window.requestAnimationFrame?window.requestAnimationFrame(paintCamera):setTimeout(paintCamera,16);
  }
  useEffect(()=>()=>{if(cameraFrame.current!=null){if(window.cancelAnimationFrame)window.cancelAnimationFrame(cameraFrame.current);else clearTimeout(cameraFrame.current);}},[]);
  const [layoutMode,setLayoutMode]=useState(()=>{try{return window.localStorage?.getItem('bubbling-context.layout')==='snake'?'snake':'straight';}catch{return 'straight';}});
  const [branchState,setBranchState]=useState({branches:[],errors:[]});
  useEffect(()=>{if(layoutMode!=='straight'||!active)return;return branchTools.watchBranches(branchContext,sessionId,setBranchState,(snapshot,id)=>mergeContexts(buildNodes(snapshot),contextSources.getSnapshot(id),trajectory.estimateTokens),contextSources);},[layoutMode,sessionId,branchContext,contextSources,active]);
  const [reduced,setReduced]=useState(()=>window.matchMedia?.('(prefers-reduced-motion: reduce)').matches||false);
  const viewport=useRef(null);
  useEffect(()=>{
    const el=viewport.current;if(!el)return;
    const wheel=e=>{
      e.preventDefault();const rect=el.getBoundingClientRect(),old=cameraRef.current;
      const unit=e.deltaMode===1?16:e.deltaMode===2?el.clientHeight:1;
      const scale=Math.max(.15,Math.min(3,old.scale*Math.exp(-e.deltaY*unit*.0015)));
      const ratio=scale/old.scale,x=e.clientX-rect.left,y=e.clientY-rect.top;
      updateCamera({scale,x:x-(x-old.x)*ratio,y:y-(y-old.y)*ratio});
    };
    el.addEventListener('wheel',wheel,{passive:false});return()=>el.removeEventListener('wheel',wheel);
  },[]);
  function startDrag(e){
    if(e.button===1&&e.target.closest?.('.bc-node')){
      const owner=e.target.closest('.bc-node'),id=owner?.getAttribute('data-drag-id');if(!id)return;
      e.preventDefault();drag.current={kind:'node',nodeId:id,id:e.pointerId,x:e.clientX,y:e.clientY,scale:cameraRef.current.scale,edit:{...(editsRef.current[id]||{x:0,y:0})}};
      e.currentTarget.setPointerCapture?.(e.pointerId);setDragging(true);return;
    }
    if(e.button!==0||e.target.closest?.('.bc-node'))return;
    e.preventDefault();drag.current={id:e.pointerId,x:e.clientX,y:e.clientY,camera:{...cameraRef.current}};
    e.currentTarget.setPointerCapture?.(e.pointerId);setDragging(true);
  }
  function moveDrag(e){const d=drag.current;if(!d||d.id!==e.pointerId)return;if(d.kind==='node'){
    const value={...editsRef.current,[d.nodeId]:{x:d.edit.x+(e.clientX-d.x)/d.scale,y:d.edit.y+(e.clientY-d.y)/d.scale}};editsRef.current=value;setEdits(value);return;
  }updateCamera({...d.camera,x:d.camera.x+e.clientX-d.x,y:d.camera.y+e.clientY-d.y});}
  function endDrag(e){if(drag.current?.id!==e.pointerId)return;drag.current=null;setDragging(false);if(e.currentTarget.hasPointerCapture?.(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);}
  useEffect(()=>{const media=window.matchMedia?.('(prefers-reduced-motion: reduce)');if(!media)return;const update=()=>setReduced(media.matches);media.addEventListener('change',update);return()=>media.removeEventListener('change',update);},[]);
  useEffect(()=>{if(!viewport.current)return;const observer=new ResizeObserver(entries=>{const rect=entries[0].contentRect;viewportSize.current={width:Math.max(260,rect.width),height:Math.max(120,rect.height||600)};setWidth(viewportSize.current.width);refreshWindow(true);});observer.observe(viewport.current);return()=>observer.disconnect();},[]);
  const request=(snapshot?.requests||[]).filter(r=>r.purpose==='assistant').at(-1);
  const branches=useMemo(()=>branchState.branches.map(b=>({...b,parentId:b.parentId===sessionId?'root':b.parentId})),[branchState.branches,sessionId]);
  const composite=useMemo(()=>layoutMode==='straight'&&branches.length?branchTools.branchLayout(nodes,branches,width,graphLayout):null,[layoutMode,branches,nodes,width]);
  const allNodes=composite?composite.points:nodes;
  const requestKey=(request?String(request.startSeq):'')+(composite?'|'+composite.lanes.map(l=>l.points.filter(n=>n.kind==='assistant').at(-1)?.id||'').join('|'):'');
  const {visible,wave,born}=useEvolution(allNodes,requestKey,reduced);
  const baseLayout=useMemo(()=>composite||graphLayout(allNodes,width,layoutMode),[composite,allNodes,width,layoutMode]);
  const movedLayout=useMemo(()=>graphState.transformGraph(baseLayout,edits),[baseLayout,edits]);
  const displayLayout=useMemo(()=>graphState.collapseGraph(movedLayout,collapsed),[movedLayout,collapsed]);
  const points=useMemo(()=>displayLayout.points.filter(p=>p.collapsedAgentId||visible.has(p.id)),[displayLayout,visible]);
  const layout={...displayLayout,points};
  const waveIndex=new Map((wave?.ids||[]).map((id,i)=>[id,i]));
  const path=rendering.edgePath;
  const connections=points.slice(1).flatMap((p,i)=>!composite||points[i].agentId===p.agentId?[{from:points[i],to:p}]:[]);
  if(composite){const shownIds=new Set(points.map(p=>p.id));connections.push(...layout.links.filter(l=>shownIds.has(l.from.id)&&shownIds.has(l.to.id)));}
  const detail=renderWindow.level==='detail';
  const drawnConnections=connections.filter(c=>rendering.edgeVisible(renderWindow,c));
  // Batch static edges by type: hundreds of segments become three paths.
  const wires=['chain','fork','creation'].map(kind=>h('path',{key:kind,d:drawnConnections.filter(c=>(c.kind||'chain')===kind).map(c=>path(c.from,c.to)).join(' '),className:'bc-link',style:kind==='creation'?{stroke:'#e49628',strokeOpacity:.95,strokeWidth:1.8}:undefined,strokeDasharray:kind==='fork'?'4 3':undefined,'data-bc':`${kind}-link`}));
  const flashes=wave?drawnConnections.filter(c=>waveIndex.has(c.to.id)).map(c=>h('path',{key:`flash:${wave.stamp}:${c.kind||'chain'}:${c.from.id}:${c.to.id}`,d:path(c.from,c.to),pathLength:1,className:'bc-wire-wave',style:{stroke:c.kind==='creation'?'#ffd27d':undefined,animationDelay:`${Math.max(0,waveIndex.get(c.to.id)*wave.duration/Math.max(1,wave.ids.length)-180)}ms`}})):[];
  const bubbles=points.flatMap((p,i)=>!rendering.nodeVisible(renderWindow,p)?[]:[h('g',{key:p.id,role:'button',tabIndex:0,className:`bc-node ${detail&&born.has(p.id)?'bc-new':''}`,'data-drag-id':p.dragId||p.id,'aria-label':`${LABELS[p.kind]}：${p.title}，${p.estimated?'估算':''}${p.tokens} tokens`,'aria-pressed':selected===p.id,
    onClick:()=>{if(p.collapsedAgentId)toggleAgent(p.collapsedAgentId);else select(p.id);},onKeyDown:e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();if(p.collapsedAgentId)toggleAgent(p.collapsedAgentId);else select(p.id);}}},
    h('title',null,`${p.title}\n${p.estimated?'≈':''}${fmt(p.tokens)} tokens · 累计 ≈${fmt(p.cumulative)}${p.usage?.cacheRead!=null?' · 缓存 '+fmt(p.usage.cacheRead):''}\n${p.text.slice(0,160)}`),
    h('rect',{x:rendering.nodeBox(p).left,y:p.y-18,width:rendering.nodeBox(p).width,height:36,rx:7,fill:'transparent',stroke:p.color,className:'bc-frame','data-bc':'data-card'}),
    h('circle',{key:waveIndex.has(p.id)?`pulse:${wave.stamp}`:'bubble',cx:rendering.nodeBox(p).left+14,cy:p.y,r:['user','context','system'].includes(p.kind)?9:6,fill:p.color,className:`bc-bubble ${waveIndex.has(p.id)?'bc-wave':''}`,style:waveIndex.has(p.id)?{animationDelay:`${waveIndex.get(p.id)*wave.duration/Math.max(1,wave.ids.length)}ms`}:{}}),
    detail&&h('svg',{x:rendering.nodeBox(p).left+30,y:p.y-18,width:rendering.nodeBox(p).width-38,height:36,overflow:'hidden',style:{minWidth:0,width:rendering.nodeBox(p).width-38,display:'inline'}},
      h('text',{x:0,y:10,className:'bc-title',style:{textAnchor:'start'}},`${i+1} · ${p.title}`),
      h('text',{x:0,y:22,style:{textAnchor:'start'}},`${p.estimated?'≈':''}${fmt(p.tokens)} tok${p.usage?.cacheRead!=null?' · 缓存 '+fmt(p.usage.cacheRead):''}`),
      h('text',{x:0,y:33,style:{textAnchor:'start'}},`累计 ≈${fmt(p.cumulative)}`)))]);
  return h('section',{className:'bc-panel','aria-label':'BubblingContext 轨迹可视化','data-testid':'bubbling-context-panel'},
    h('header',{className:'bc-heading'},h(BubbleIcon),h('h2',null,'BubblingContext'),h('select',{className:'bc-button','aria-label':'显示类型',title:'显示类型',value:layoutMode,onChange:e=>{const mode=e.target.value;setLayoutMode(mode);try{window.localStorage?.setItem('bubbling-context.layout',mode);}catch{}}},h('option',{value:'straight'},'直线'),h('option',{value:'snake'},'蛇形')),h('button',{className:'bc-button',onClick:close,'aria-label':'关闭 BubblingContext 面板'},'×')),
    h('div',{className:'bc-legend'},...Object.keys(COLORS).map(kind=>h('span',{key:kind},h('i',{className:'bc-dot',style:{background:COLORS[kind]}}),LABELS[kind]))),
    h('div',{className:'bc-status'},h('span',{className:session.running?'bc-live':''},wave?'● 高亮传递中':session.running?'● 实时更新中':'● 已同步'),h('span',null,`${points.length} / ${allNodes.length} 个节点${composite?' · '+branches.length+' 个 Agent 分支':''}`),h('span',{ref:zoomLabel,'aria-label':'当前缩放比例'},`${Math.round(camera.scale*100)}%`),h('button',{className:'bc-button',onClick:()=>updateCamera({x:0,y:0,scale:1})},'重置视图'),h('button',{className:'bc-button',onClick:()=>{setEdits({});editsRef.current={};}},'重置节点'),h('button',{className:'bc-button',onClick:()=>{const last=points.at(-1);if(!last||!viewport.current)return;updateCamera({...cameraRef.current,x:viewport.current.clientWidth/3-last.x*cameraRef.current.scale,y:viewport.current.clientHeight/2-last.y*cameraRef.current.scale});}},'定位最新')),
    customRecords.filter(r=>r.error).map(r=>h('div',{className:'bc-error',key:r.sourceId},`${r.sourceId}: ${r.error}`)),
    customRecords.filter(r=>!r.error&&!baseNodes.some(n=>n.id===r.afterNodeId)).length>0&&h('div',{className:'bc-status'},'部分自定义上下文的挂载节点尚未加载。'),
    layoutMode==='straight'&&branchState.errors.map((message,i)=>h('div',{className:'bc-error',key:i,role:'alert'},message)),
    layoutMode==='straight'&&!branchState.ready&&h('div',{className:'bc-status'},'Agent 分支服务尚未就绪；更新插件后需重启 DSH。'),
    layoutMode==='straight'&&branchState.mainMeta&&h('div',{className:'bc-status'},`主 Agent：输入 ${fmt(branchState.mainMeta.usage.input)} · 输出 ${fmt(branchState.mainMeta.usage.output)} · 已报告调用合计 ${fmt(branchState.mainMeta.usage.total)} tok`),
    composite&&h('div',{style:{maxHeight:130,overflow:'auto',padding:'0 16px 8px',fontSize:11}},...composite.lanes.filter(l=>l.id!=='main').map(l=>h('div',{key:l.id,style:{border:'1px solid #ffffff20',padding:6,marginBottom:4,borderRadius:5}},
      h('strong',null,`${l.isFork===null?'来源待加载':l.isFork?'Fork · 继承上下文':'子 Agent · 独立上下文'}：${l.label} · ${l.running?'运行中':'空闲'}`),
      h('button',{className:'bc-button','aria-expanded':!collapsed[l.id],onClick:()=>toggleAgent(l.id)},collapsed[l.id]?'展开':'折叠'),
      h('div',null,`新增输入 ${fmt(l.meta?.usage?.input)} · 输出 ${fmt(l.meta?.usage?.output)} · 缓存读取 ${l.meta?.usage?.cacheReported?fmt(l.meta.usage.cacheRead):'未报告'} · 调用合计 ${fmt(l.meta?.usage?.total)}`),
      l.isFork&&h('div',null,`继承前缀：${fmt(l.meta?.inheritedEventCount)} 条事件 · 已加载内容 ≈${fmt(l.inheritTokens)} tok（不重复计入新增用量）`),
      l.hasMore&&h('button',{className:'bc-button',onClick:async()=>{try{await loadOlder(l.id);}catch(e){setError(e.message);}}},'加载该 Agent 更早记录')))),
    composite&&composite.unresolved.length>0&&h('div',{className:'bc-status'},composite.unresolved.join('；')),
    session.hasMore&&h('div',{className:'bc-status'},'当前为部分历史',h('button',{className:'bc-button',disabled:session.loadingOlder,onClick:async()=>{try{setError('');await loadOlder(sessionId);}catch(e){setError(e.message);}}},session.loadingOlder?'加载中…':'加载更早记录')),
    error&&h('div',{className:'bc-error',role:'alert'},error),
    h('div',{className:'bc-canvas',ref:viewport,title:'左键拖动画布 · 中键拖动圆形节点及下游 · 滚轮缩放',onAuxClick:e=>{if(e.button===1)e.preventDefault();},onPointerDown:startDrag,onPointerMove:moveDrag,onPointerUp:endDrag,onPointerCancel:endDrag,onLostPointerCapture:endDrag,style:{overflow:'hidden',position:'relative',touchAction:'none',userSelect:dragging?'none':undefined,cursor:dragging?'grabbing':'grab'}},allNodes.length?h('div',{ref:cameraStage,'data-bc':'camera-stage',style:{position:'absolute',top:0,left:0,transformOrigin:'0 0',transform:`translate3d(${camera.x}px, ${camera.y}px, 0) scale(${camera.scale})`}},h('svg',{viewBox:`0 0 ${layout.width||width} ${layout.height}`,height:layout.height,style:{width:layout.width||width,minWidth:layout.width||width,overflow:'visible'},role:'group','aria-label':'实时上下文演进图'},
      ...(composite?layout.lanes.map(l=>h('g',{key:`lane:${l.id}`},h('line',{x1:l.x+8,y1:l.y-14,x2:l.x+8,y2:l.collapsed?l.y+80:layout.height,stroke:'#ffffff15',strokeDasharray:'3 6'}),h('text',{x:l.x+20,y:l.y,fill:'#ccc',fontSize:11,role:l.id==='main'?undefined:'button',tabIndex:l.id==='main'?undefined:0,onClick:()=>{if(l.id!=='main')toggleAgent(l.id);},onKeyDown:e=>{if(l.id!=='main'&&(e.key==='Enter'||e.key===' ')){e.preventDefault();toggleAgent(l.id);}}},l.id==='main'?'主 Agent':`${collapsed[l.id]?'▸':'▾'} ${l.isFork?'Fork':'子 Agent'} · ${l.label.slice(0,24)}`))):[]),...wires,...flashes,...bubbles)):h('div',{className:'bc-empty'},h('strong',null,'等待第一颗气泡'),'开始对话后，上下文与调用会沿白色连线依次浮现。')),
    h(Details,{node:points.find(n=>n.id===selected),onClose:()=>select(null)}),
    h('footer',{className:'bc-footer'},'≈ 为文本估算。累计从已加载起点计算，不等于实际 KV 缓存或当前窗口。缓存命中仅显示每次调用实报值。'));
}
const MemoGraph=React.memo(LiveGraph);
function BufferedGraph({useTrajectory,useSession,active=true,...props}){
  const held=useRef({});
  const raw=useTrajectory(s=>{if(active||!held.current.snapshot)held.current.snapshot=s;return held.current.snapshot;});
  const session=useSession(s=>{if(active||!held.current.session)held.current.session=s;return held.current.session;});
  const latest=useRef(raw);latest.current=raw;
  const [sample,setSample]=useState(raw),timer=useRef(null);
  useEffect(()=>{if(active&&raw!==sample&&timer.current==null)timer.current=setTimeout(()=>{timer.current=null;setSample(latest.current);},32);},[raw,sample,active]);
  useEffect(()=>()=>{clearTimeout(timer.current);timer.current=null;},[active]);
  return h(MemoGraph,{...props,active,sourceSnapshot:sample,sourceSession:session});
}
class GraphBoundary extends React.Component{
  constructor(props){super(props);this.state={error:null};}
  static getDerivedStateFromError(error){return {error:error.message||String(error)};}
  render(){return this.state.error?h('div',{className:'bc-error',role:'alert'},'轨迹可视化暂不可用：'+this.state.error,h('button',{className:'bc-button',onClick:()=>this.setState({error:null})},'重试加载')):this.props.children;}
}
exports.name='bubbling-context-client';
exports.inject=['slots','sidebarRight','sidebarRightTabs','sessions','uiConversation'];
exports.apply=function(ctx){
  const contextSources=createContextRegistry();
  ctx.effect(()=>{const off=ctx.reflect.provide('bubblingContextSources',contextSources);return()=>{off();contextSources.dispose();};});
  ctx.effect(()=>{const style=document.createElement('style');style.dataset.bubblingContext='true';style.textContent=css;document.head.appendChild(style);return()=>style.remove();});
  ctx.effect(()=>ctx.sidebarRightTabs.register({id:ID,kind:KIND,title:()=>'BubblingContext',keepMounted:true,guide:[{id:'trajectory',order:25,title:()=>'BubblingContext',description:()=>'实时上下文气泡与调用轨迹',icon:BubbleIcon}]}));
  function OpenButton(){return h('button',{type:'button',className:'bc-trigger',title:'打开 BubblingContext · 轨迹可视化','aria-label':'打开 BubblingContext 轨迹可视化面板','data-testid':'bubbling-context-open',onClick:()=>ctx.sidebarRight.openTab(KIND)},h(BubbleIcon));}
  function Panel(props){const {tab}=props.useTabInfo();return h(GraphBoundary,{key:props.sessionId},h(BufferedGraph,{...props,active:tab.visible!==false,branchContext:ctx,contextSources,key:props.sessionId,close:()=>tab.actions.close(),loadOlder:async id=>{const session=ctx.sessions.binding(id)?.session;if(!session)throw new Error('当前会话不可用');await session.loadOlder();}}));}
  ctx.effect(()=>ctx.slots.inject('conversation.session.header.utilities',()=>ctx.slots.register({name:'conversation.session.header.utilities',id:ID,order:-20,registrant:ID},OpenButton)));
  ctx.effect(()=>ctx.slots.inject('sidebar.right.pane.tab',()=>ctx.slots.register({name:'sidebar.right.pane.tab',key:ID},Panel)));
};
