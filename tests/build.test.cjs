const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawnSync}=require('node:child_process');
test('generated bundle matches source and no local imports remain',()=>{
 const root=path.resolve(__dirname,'..'),temp=fs.mkdtempSync(path.join(os.tmpdir(),'bc-build-'));
 try{fs.cpSync(path.join(root,'src'),path.join(temp,'src'),{recursive:true});fs.cpSync(path.join(root,'scripts'),path.join(temp,'scripts'),{recursive:true});
 const run=spawnSync(process.execPath,[path.join(temp,'scripts/build.mjs')],{encoding:'utf8'});a.equal(run.status,0,run.stderr);
 const bundle=fs.readFileSync(path.join(temp,'lib/client.js'),'utf8');a.equal(bundle,fs.readFileSync(path.join(root,'lib/client.js'),'utf8'));a.doesNotMatch(bundle,/require\(['"]\.\//);
 const file=path.join(temp,'src/client.cjs');fs.writeFileSync(file,fs.readFileSync(file,'utf8').replace("require('./trajectory.cjs')","require('./missing.cjs')"));
 a.notEqual(spawnSync(process.execPath,[path.join(temp,'scripts/build.mjs')]).status,0);
 }finally{fs.rmSync(temp,{recursive:true,force:true});}
});
