const React = require('react');
const trajectory = require('./trajectory.cjs');
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
  latest.current=nodes;
  const identity=nodes.map(n=>n.id).join('|');
  useEffect(()=>{
    if(!initialized.current && nodes.length){initialized.current=true;known.current=new Set(nodes.map(n=>n.id));setVisible(new Set(known.current));lastRequest.current=requestKey;return;}
    // Paging backwards reveals older history directly; it is not a new call.
    const firstKnown=nodes.find(n=>known.current.has(n.id));
    const older=firstKnown?nodes.filter(n=>!known.current.has(n.id)&&n.seq<firstKnown.seq):[];
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
      function reveal(){const node=additions[cursor++];if(node){known.current.add(node.id);setVisible(new Set(known.current));}
        if(cursor<additions.length)timer.current=setTimeout(reveal,Math.min(90,600/additions.length));
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
    h('pre',null,node.text||(node.status==='running'?'等待模型输出…':'无文本内容')),
    node.extra&&h('details',null,h('summary',null,'查看工具定义'),h('pre',null,stringify(node.extra))),
    h('details',null,h('summary',null,`原始轨迹记录 · seq ${node.seq}`),h('pre',null,stringify(node.source))));
}
function LiveGraph({useTrajectory,useSession,sessionId,close,loadOlder}){
  const snapshot=useTrajectory(s=>s), session=useSession(s=>s);
  const nodes=useMemo(()=>buildNodes(snapshot),[snapshot]);
  const [selected,select]=useState(null),[width,setWidth]=useState(420),[error,setError]=useState(''),[follow,setFollow]=useState(true);
  const [layoutMode,setLayoutMode]=useState(()=>{try{return window.localStorage?.getItem('bubbling-context.layout')==='snake'?'snake':'straight';}catch{return 'straight';}});
  const [reduced,setReduced]=useState(()=>window.matchMedia?.('(prefers-reduced-motion: reduce)').matches||false);
  const viewport=useRef(null);
  useEffect(()=>{const media=window.matchMedia?.('(prefers-reduced-motion: reduce)');if(!media)return;const update=()=>setReduced(media.matches);media.addEventListener('change',update);return()=>media.removeEventListener('change',update);},[]);
  useEffect(()=>{if(!viewport.current)return;const observer=new ResizeObserver(entries=>setWidth(Math.max(260,entries[0].contentRect.width)));observer.observe(viewport.current);return()=>observer.disconnect();},[]);
  const request=(snapshot?.requests||[]).filter(r=>r.purpose==='assistant').at(-1);
  const {visible,wave,born}=useEvolution(nodes,request?String(request.startSeq):'',reduced);
  const shown=nodes.filter(n=>visible.has(n.id)),layout=graphLayout(shown,width,layoutMode),points=layout.points;
  const waveIndex=new Map((wave?.ids||[]).map((id,i)=>[id,i]));
  useEffect(()=>{if(follow&&viewport.current)viewport.current.scrollTop=viewport.current.scrollHeight;},[shown.length,follow,layoutMode]);
  function path(a,b){const dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy)||1;return `M ${a.x+dx*a.radius/length} ${a.y+dy*a.radius/length} L ${b.x-dx*b.radius/length} ${b.y-dy*b.radius/length}`;}
  const symbols={system:'S',user:'U',context:'C',assistant:'A',tool:'T'};
  const wires=points.slice(1).map((p,i)=>h('path',{key:`line:${p.id}`,d:path(points[i],p),className:'bc-link'}));
  const flashes=wave?points.slice(1).filter(p=>waveIndex.has(p.id)).map(p=>{const i=points.findIndex(x=>x.id===p.id);return h('path',{key:`flash:${wave.stamp}:${p.id}`,d:path(points[i-1],p),className:'bc-wire-wave',style:{animationDelay:`${waveIndex.get(p.id)*wave.duration/Math.max(1,wave.ids.length)}ms`}});}):[];
  const bubbles=points.map((p,i)=>h('g',{key:p.id,role:'button',tabIndex:0,className:`bc-node ${born.has(p.id)?'bc-new':''}`,'aria-label':`${LABELS[p.kind]}：${p.title}，${p.estimated?'估算':''}${p.tokens} tokens`,'aria-pressed':selected===p.id,
    onClick:()=>select(p.id),onKeyDown:e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();select(p.id);}}},
    h('title',null,`${p.title}\n${p.estimated?'≈':''}${fmt(p.tokens)} tokens · 累计 ≈${fmt(p.cumulative)}${p.usage?.cacheRead!=null?' · 缓存 '+fmt(p.usage.cacheRead):''}\n${p.text.slice(0,160)}`),
    h('circle',{key:waveIndex.has(p.id)?`pulse:${wave.stamp}`:'bubble',cx:p.x,cy:p.y,r:p.radius,fill:p.color,className:`bc-bubble ${waveIndex.has(p.id)?'bc-wave':''}`,style:waveIndex.has(p.id)?{animationDelay:`${waveIndex.get(p.id)*wave.duration/Math.max(1,wave.ids.length)}ms`}:{}}),
    h('text',{x:p.x,y:p.y+(p.radius<=12?3:4),className:'bc-symbol',style:p.radius<=12?{fontSize:9}:{}},symbols[p.kind]),
    h('line',{x1:p.x+(p.cardOnLeft?-p.radius:p.radius),y1:p.y,x2:p.cardOnLeft?p.cardX+p.cardWidth:p.cardX,y2:p.y,stroke:p.color,strokeWidth:1,strokeOpacity:.7,'data-bc':'card-connector'}),
    h('rect',{x:p.cardX,y:p.y-18,width:p.cardWidth,height:36,rx:5,fill:'var(--dsw-alias-background-default,#202020)',stroke:p.color,strokeOpacity:selected===p.id ? .8 : .35,strokeWidth:.7,'data-bc':'data-card'}),
    h('svg',{x:p.cardX+8,y:p.y-18,width:p.cardWidth-16,height:36,overflow:'hidden',style:{minWidth:0,width:p.cardWidth-16,display:'inline'}},
      h('text',{x:0,y:10,className:'bc-title',style:{textAnchor:'start'}},`${i+1} · ${p.title}`),
      h('text',{x:0,y:22,style:{textAnchor:'start'}},`${p.estimated?'≈':''}${fmt(p.tokens)} tok${p.usage?.cacheRead!=null?' · 缓存 '+fmt(p.usage.cacheRead):''}`),
      h('text',{x:0,y:33,style:{textAnchor:'start'}},`累计 ≈${fmt(p.cumulative)}`))));
  return h('section',{className:'bc-panel','aria-label':'BubblingContext 轨迹可视化','data-testid':'bubbling-context-panel'},
    h('header',{className:'bc-heading'},h(BubbleIcon),h('h2',null,'BubblingContext'),h('select',{className:'bc-button','aria-label':'显示类型',title:'显示类型',value:layoutMode,onChange:e=>{const mode=e.target.value;setLayoutMode(mode);try{window.localStorage?.setItem('bubbling-context.layout',mode);}catch{}}},h('option',{value:'straight'},'直线'),h('option',{value:'snake'},'蛇形')),h('button',{className:'bc-button',onClick:close,'aria-label':'关闭 BubblingContext 面板'},'×')),
    h('div',{className:'bc-legend'},...Object.keys(COLORS).map(kind=>h('span',{key:kind},h('i',{className:'bc-dot',style:{background:COLORS[kind]}}),LABELS[kind]))),
    h('div',{className:'bc-status'},h('span',{className:session.running?'bc-live':''},wave?'● 高亮传递中':session.running?'● 实时更新中':'● 已同步'),h('span',null,`${shown.length} / ${nodes.length} 个节点`),h('button',{className:'bc-button',onClick:()=>setFollow(v=>!v),'aria-pressed':follow},follow?'跟随最新 ✓':'跟随最新')),
    session.hasMore&&h('div',{className:'bc-status'},'当前为部分历史',h('button',{className:'bc-button',disabled:session.loadingOlder,onClick:async()=>{try{setError('');setFollow(false);await loadOlder(sessionId);}catch(e){setError(e.message);}}},session.loadingOlder?'加载中…':'加载更早记录')),
    error&&h('div',{className:'bc-error',role:'alert'},error),
    h('div',{className:'bc-canvas',ref:viewport},nodes.length?h('svg',{viewBox:`0 0 ${width} ${layout.height}`,height:layout.height,role:'group','aria-label':'实时上下文演进图'},...wires,...flashes,...bubbles):h('div',{className:'bc-empty'},h('strong',null,'等待第一颗气泡'),'开始对话后，上下文与调用会沿白色连线依次浮现。')),
    h(Details,{node:nodes.find(n=>n.id===selected),onClose:()=>select(null)}),
    h('footer',{className:'bc-footer'},'≈ 为文本估算。累计从已加载起点计算，不等于实际 KV 缓存或当前窗口。缓存命中仅显示每次调用实报值。'));
}
exports.name='bubbling-context-client';
exports.inject=['slots','sidebarRight','sidebarRightTabs','sessions'];
exports.apply=function(ctx){
  ctx.effect(()=>{const style=document.createElement('style');style.dataset.bubblingContext='true';style.textContent=css;document.head.appendChild(style);return()=>style.remove();});
  ctx.effect(()=>ctx.sidebarRightTabs.register({id:ID,kind:KIND,title:()=>'BubblingContext',keepMounted:true,guide:[{id:'trajectory',order:25,title:()=>'BubblingContext',description:()=>'实时上下文气泡与调用轨迹',icon:BubbleIcon}]}));
  function OpenButton(){return h('button',{type:'button',className:'bc-trigger',title:'打开 BubblingContext · 轨迹可视化','aria-label':'打开 BubblingContext 轨迹可视化面板','data-testid':'bubbling-context-open',onClick:()=>ctx.sidebarRight.openTab(KIND)},h(BubbleIcon));}
  function Panel(props){const {tab}=props.useTabInfo();return h(LiveGraph,{...props,key:props.sessionId,close:()=>tab.actions.close(),loadOlder:async id=>{const session=ctx.sessions.binding(id)?.session;if(!session)throw new Error('当前会话不可用');await session.loadOlder();}});}
  ctx.effect(()=>ctx.slots.inject('conversation.session.header.utilities',()=>ctx.slots.register({name:'conversation.session.header.utilities',id:ID,order:-20,registrant:ID},OpenButton)));
  ctx.effect(()=>ctx.slots.inject('sidebar.right.pane.tab',()=>ctx.slots.register({name:'sidebar.right.pane.tab',key:ID},Panel)));
};
