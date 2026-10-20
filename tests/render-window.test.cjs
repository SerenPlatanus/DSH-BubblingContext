const {test}=require('node:test');
const assert=require('node:assert/strict');
const r=require('../src/render-window.cjs');
test('zoom levels and overscan keep small camera moves out of React',()=>{
 const c={x:0,y:0,scale:1},v=r.windowFor(c,800,600);
 assert.equal(r.contains(v,{...c,y:-100},800,600),true);
 assert.equal(r.contains(v,{...c,y:-500},800,600),false);
 assert.equal(r.contains(v,{...c,scale:.2},800,600),false);
 assert.equal(r.level(.2),'overview');assert.equal(r.level(.5),'compact');assert.equal(r.level(1),'detail');
});
test('offscreen circles, visible cards and crossing branch links',()=>{
 const v={left:0,right:800,top:0,bottom:600,level:'detail'};
 const p={x:-100,y:50,radius:12,cardX:10,cardWidth:200};
 assert.equal(r.nodeVisible(v,p),true);
 assert.equal(r.nodeVisible({...v,level:'overview'},p),false);
 assert.equal(r.nodeVisible(v,{...p,y:10000}),false);
 assert.equal(r.edgeVisible(v,{from:{x:-100,y:200},to:{x:900,y:300}}),true);
 assert.equal(r.edgeVisible(v,{from:{x:20,y:900},to:{x:30,y:1000}}),false);
});
test('2000 node fixture limits detail drawing and removes overview text cards',()=>{
 const points=Array.from({length:2000},(_,i)=>({x:36,y:66+i*56,radius:12,cardX:73,cardWidth:300}));
 const v=r.windowFor({x:0,y:0,scale:1},800,600);
 assert.ok(points.filter(p=>r.nodeVisible(v,p)).length<20);
 const far=r.windowFor({x:0,y:-56000,scale:1},800,600);
 assert.ok(points.filter(p=>r.nodeVisible(far,p)).length<25);
});
