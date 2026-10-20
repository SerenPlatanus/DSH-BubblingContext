const {test}=require('node:test'),a=require('node:assert/strict');
const {buildNodes,estimateTokens}=require('../src/trajectory.cjs');
const req=(startSeq,more={})=>({purpose:'assistant',turn:1,step:1,startSeq,startedAt:startSeq,status:'complete',...more});
test('tools-only changes never repeat system; system-only never repeats catalog',()=>{
 const prompt={system:'system text',tools:[{name:'read',description:'read files'}]};
 const nodes=buildNodes({systemPrompts:[{seq:0,text:prompt.system}],requests:[req(1,{prompt,promptChange:{seq:0,kind:'initial'}}),req(4,{prompt,promptChange:{seq:3,kind:'tools'}}),req(7,{prompt,promptChange:{seq:6,kind:'system'}})]});
 a.equal(nodes.filter(n=>n.text===prompt.system).length,2);
 a.equal(nodes.filter(n=>n.extra).length,2);
 a.equal(nodes.find(n=>n.id==='tools:3').text,'');
 a.equal(nodes.find(n=>n.id==='system:6').extra,undefined);
});
test('same-step retries preserve each request and associate final result correctly',()=>{
 const nodes=buildNodes({requests:[req(1,{status:'error',error:'network'}),req(5,{resultSeq:8,usage:{outputTokens:3}})],eventNodes:[{kind:'assistant',seq:8,turn:1,step:1,blocks:[{kind:'text',text:'ok'}]},...['model-retry','turn-error','turn-max-tokens','command','unknown'].map((kind,i)=>({kind,seq:10+i,message:kind}))]});
 a.equal(nodes.filter(n=>n.kind==='assistant').length,2);
 a.equal(nodes.find(n=>n.id==='assistant:1:1').status,'error');
 a.equal(nodes.find(n=>n.id==='assistant:1:1:request:5').text,'ok');
 a.equal(nodes.filter(n=>n.nonContext&&n.kind!=='assistant').length,5);a.ok(nodes.filter(n=>n.nonContext).every(n=>n.tokens===0));
});
test('parallel running tools sort by time and structured error survives',()=>{
 const nodes=buildNodes({requests:[req(1,{status:'running'})],runningCalls:[{callId:'a',turn:1,step:1,time:20},{callId:'z',turn:1,step:1,time:10}],eventNodes:[{kind:'tool-result',seq:9,callId:'bad',isError:true,error:{name:'Error',code:'ENOENT'},content:[]}]});
 a.deepEqual(nodes.filter(n=>n.status==='running'&&n.kind==='tool').map(n=>n.id),['tool:z','tool:a']);a.match(nodes.find(n=>n.id==='tool:bad').text,/ENOENT/);
});
test('images do not count attachment JSON; compaction carries host replacement facts',()=>{
 const nodes=buildNodes({eventNodes:[{kind:'user',seq:1,content:[{type:'image',attachment:{huge:'x'.repeat(30000)}}]},{kind:'compaction',seq:2,summary:'summary',shadowedItemCount:8,shadowedTokenCount:900}]});
 a.equal(nodes[0].tokens,0);a.match(nodes[0].text,/图片/);a.equal(nodes[1].shadowedTokenCount,900);
});
test('fast estimator preserves previous Unicode heuristic; reused mutable sources cannot stale tokens',()=>{
 for(const text of ['','hello','汉字abc','😀𠮷한글abc','x'.repeat(30000)]){const chars=Array.from(text),wide=chars.filter(c=>/[\u2e80-\u9fff\uac00-\ud7af]/u.test(c)).length;a.equal(estimateTokens(text),Math.ceil(wide+(chars.length-wide)/4));}
 const e={kind:'user',seq:1,content:[{text:'abcd'}]},s={eventNodes:[e]};a.equal(buildNodes(s)[0].tokens,1);e.content[0].text='abcdefgh';a.equal(buildNodes(s)[0].tokens,2);
});
