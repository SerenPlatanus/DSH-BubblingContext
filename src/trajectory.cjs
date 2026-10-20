// Pure adapter over DSH's public TrajectorySnapshot. Never changes a session.
const COLORS = { system: '#9ca3af', user: '#75a5ed', context: '#4caf79', assistant: '#a07bc3', tool: '#e49628' };
const LABELS = { system: '系统提示词', user: '用户输入', context: '注入上下文', assistant: '助手 / Tool call', tool: '工具调用' };
function stringify(value) {
  if (typeof value === 'string') return value;
  if (value == null) return '';
  try { return JSON.stringify(value, null, 2); } catch { return String(value); }
}
function contentText(blocks) {
  return (blocks || []).map(b => b.text ?? ((b.kind||b.type) === 'tool-call' ? `${b.name}\n${b.argsRaw || ''}` : (b.kind||b.type)==='image'?'[图片：Token 未估算]':'[非文本内容：Token 未估算]')).join('\n');
}
const tokenCache=new WeakMap();
// Deliberately labelled an estimate: not the provider's tokenizer or billing.
function estimateTokens(text) {
  text=text||'';
  const wide=(text.match(/[\u2e80-\u9fff\uac00-\ud7af]/g)||[]).length;
  const pairs=(text.match(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g)||[]).length;
  return Math.ceil(wide+(text.length-pairs-wide)/4);
}
function countedText(text){return text.replace(/\[(?:图片|非文本内容)：Token 未估算\]/g,'');}
function number(value) { return Number.isFinite(value) && value >= 0 ? value : null; }
function usageFacts(raw) {
  const u = raw || {};
  return { input: number(u.inputTokens), output: number(u.outputTokens),
    cacheRead: number(u.cacheReadTokens), cacheWrite: number(u.cacheWriteTokens) };
}
function buildNodes(snapshot) {
  if (!snapshot) return [];
  const records = new Map();
  function put(node) { records.set(node.id, node); }
  const requests = (snapshot.requests || []).filter(r => r.purpose === 'assistant');
  const requestIds=new Map(),byStep=new Map();
  for(const r of requests){const base=`assistant:${r.turn}:${r.step}`,list=byStep.get(base)||[];requestIds.set(r,list.length?`${base}:request:${r.startSeq}`:base);list.push(r);byStep.set(base,list);}
  for (const s of snapshot.systemPrompts || []) put({ id: `system:${s.seq}`, seq: s.seq, time: s.time, kind: 'system', title: s.update ? '系统提示词更新' : '系统提示词', text: s.text, source: s });
  // Preserve tool catalog changes as system nodes, including an initial prompt
  // whose system event lies outside the currently loaded event window.
  for (const r of requests) {
    const c = r.promptChange;
    if (c && r.prompt) {
      if(c.kind!=='tools'&&!records.has(`system:${c.seq}`))put({id:`system:${c.seq}`,seq:c.seq,time:c.time,kind:'system',title:'系统提示词',text:r.prompt.system||'',source:r.prompt});
      if(['initial','tools','system-and-tools'].includes(c.kind))put({id:`tools:${c.seq}`,seq:c.seq+.01,time:c.time,kind:'system',title:'工具目录'+(c.kind==='initial'?'':'更新'),text:'',extra:r.prompt.tools,source:r.prompt});
    }
    const facts = usageFacts(r.usage);
    put({ id: requestIds.get(r), seq: r.resultSeq ?? r.startSeq + 0.5, time: r.startedAt,
      kind: 'assistant', title: `助手 · 第 ${r.turn} 轮 / 第 ${r.step} 步`,
      status: r.status, request: r, usage: facts, text:r.error||'',nonContext:r.status==='error'&&facts.output==null,source: r });
  }
  for (const e of snapshot.eventNodes || []) {
    if (e.kind === 'assistant') {
      const base=`assistant:${e.turn}:${e.step}`,matching=(byStep.get(base)||[]).find(r=>r.resultSeq===e.seq);
      const id=matching?requestIds.get(matching):!records.has(base)?base:`${base}:event:${e.messageId||e.seq}`;
      const existing = records.get(id);
      put({ ...existing, id, seq: e.seq, time: e.time, kind: 'assistant', title: `助手 · 第 ${e.turn} 轮 / 第 ${e.step} 步`,
        text: contentText(e.blocks), usage: usageFacts(e.usage || existing?.request?.usage), source: e,
        status: e.interrupted ? 'interrupted' : 'complete' });
    } else if (['user', 'steering', 'context'].includes(e.kind)) {
      const kind = e.kind === 'context' ? 'context' : 'user';
      put({ id: `${kind}:${e.seq}`, seq: e.seq, time: e.time, kind, title: LABELS[kind], text: contentText(e.content), source: e });
    } else if (e.kind === 'compaction') {
      put({ id: `compaction:${e.seq}`, seq: e.seq, time: e.time, kind: 'context', title: '上下文压缩检查点', text: e.summary || '摘要未加载', source: e, checkpoint: true,shadowedItemCount:e.shadowedItemCount,shadowedTokenCount:e.shadowedTokenCount });
    }else if(e.kind!=='tool-result'){
      const titles={'model-retry':'模型重试','turn-error':'轮次失败','turn-max-tokens':'输出达到上限',command:'命令',unknown:'未识别事件'};
      put({id:`${e.kind}:${e.seq}`,seq:e.seq,time:e.time,kind:e.kind==='command'?'tool':'context',title:titles[e.kind]||`事件 · ${e.kind}`,text:e.message||e.outcome?.text||e.args||e.retryState||e.type||'',status:e.kind==='turn-error'?'error':e.retryState,source:e,nonContext:true});
    }
  }
  const partial = snapshot.partial;
  if (partial) {
    const base=`assistant:${partial.turn}:${partial.step}`,r=(byStep.get(base)||[]).filter(r=>r.status==='running').at(-1);
    const id=r?requestIds.get(r):base;
    const old = records.get(id);
    if (!old || old.status !== 'complete') put({ ...old, id, seq: old?.seq ?? Number.MAX_SAFE_INTEGER - 1, time: old?.time,
      kind: 'assistant', title: `助手 · 第 ${partial.turn} 轮 / 第 ${partial.step} 步`, text: contentText(partial.blocks), status: 'running', source: partial });
  }
  function tool(e, parent) {
    const settled = e.kind === 'tool-result';
    const args = settled ? e.call?.argsRaw : e.argsRaw;
    const result = settled ? contentText(e.content) : '';
    put({ id: `tool:${e.callId}`, seq: settled ? e.seq : (parent?.seq ?? Number.MAX_SAFE_INTEGER - 2) + 0.1,
      time: settled ? e.callTime ?? e.time : e.time, kind: 'tool', title: e.call?.name || e.name || e.callId,
      text: `${args || ''}${result ? '\n\n→ 工具结果\n' + result : ''}${e.error?'\n'+[e.error.name,e.error.code,e.error.reason].filter(Boolean).join(' · '):''}`, status: settled ? (e.isError ? 'error' : 'complete') : 'running', source: e });
    for (const child of e.subCalls || []) tool(child, e);
  }
  for (const e of snapshot.eventNodes || []) if (e.kind === 'tool-result') tool(e);
  for (const e of snapshot.runningCalls || []) {
    const base=`assistant:${e.turn}:${e.step}`,r=(byStep.get(base)||[]).at(-1);
    const parent = records.get(r?requestIds.get(r):base);
    if (!records.has(`tool:${e.callId}`)) tool(e, parent);
  }
  const nodes = [...records.values()].sort((a,b) => a.seq - b.seq || (a.time??0)-(b.time??0) || a.id.localeCompare(b.id));
  let cumulative = 0;
  for (const node of nodes) {
    const text=countedText(node.text)+(node.extra?stringify(node.extra):'');
    const old=tokenCache.get(node.source);
    const estimated=old?.text===text?old.tokens:estimateTokens(text);
    if(node.source&&typeof node.source==='object')tokenCache.set(node.source,{text,tokens:estimated});
    node.tokens = node.nonContext?0:node.kind === 'assistant' && node.usage?.output != null ? node.usage.output : estimated;
    node.estimated = !(node.kind === 'assistant' && node.usage?.output != null);
    cumulative += node.tokens;
    node.cumulative = cumulative;
    node.color = COLORS[node.kind];
  }
  return nodes;
}
function graphLayout(nodes, width = 420, mode = 'straight') {
  const radius = n => ['user','context'].includes(n.kind) ? 25 : n.kind === 'system' ? 22 : 12;
  const cardWidth = Math.max(150, Math.min(280, width - 100, width * 0.46));
  const left = 34;
  // Cards can sit on either side, so a wide snake need not reserve a whole
  // card column at the right edge. Retain the narrow-panel fallback.
  const right = Math.max(left, mode === 'snake' && width >= 400 ? width - 34 : width - cardWidth - 50);
  const steps = Math.max(2, Math.min(6, Math.ceil((right-left)/65)));
  let y = 36;
  const points = nodes.map((n,i) => {
    const r = radius(n);
    if (i) y += Math.max(40, radius(nodes[i-1]) + r + 6);
    // Sample a downward zigzag: left → right → left, never horizontal rows.
    const phase = i % (steps*2);
    const fraction = (phase <= steps ? phase : steps*2-phase) / steps;
    const x = mode === 'snake' ? left+(right-left)*fraction : Math.min(right,Math.max(42,width*0.18));
    const cardOnLeft = mode === 'snake' && x >= Math.max(195,width*0.5);
    const available = cardOnLeft ? x-49 : width-x-45;
    const fittedWidth = Math.min(cardWidth,available);
    return { ...n, x, y, radius:r, cardOnLeft,
      cardX:cardOnLeft ? x-37-fittedWidth : x+37, cardWidth:fittedWidth };
  });
  return { height:Math.max(100,y+44),points };
}
module.exports = { COLORS, LABELS, buildNodes, graphLayout, usageFacts, estimateTokens, stringify };
