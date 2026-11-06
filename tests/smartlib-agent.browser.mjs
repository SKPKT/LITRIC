import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {sha} from '../lib/standalone-auth.mjs';
const require=createRequire(import.meta.url);
const {Miniflare}=require('miniflare');
const {chromium}=await import('playwright-core');
const root=fileURLToPath(new URL('..',import.meta.url));
const artifacts=process.env.LITRIC_QA_ARTIFACTS || fs.mkdtempSync(path.join(os.tmpdir(),'litric-agent-browser-'));
fs.mkdirSync(artifacts,{recursive:true});
const executable=process.env.LITRIC_BROWSER_EXECUTABLE || ['/usr/bin/chromium','/usr/bin/google-chrome','/usr/bin/google-chrome-stable'].find(file=>fs.existsSync(file));
if(!executable) throw new Error('Set LITRIC_BROWSER_EXECUTABLE to an installed Chromium or Chrome binary.');
const setup=Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('hex'), temporary=crypto.randomUUID(), password=crypto.randomUUID();
const mf=new Miniflare({name:'litric-api',modules:true,host:'127.0.0.1',port:0,
  scriptPath:root+'/standalone/dist-api/worker.js',compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],
  assets:{directory:root+'/dist-worker',binding:'ASSETS',workerName:'litric-api',routerConfig:{has_user_worker:true,invoke_user_worker_ahead_of_assets:true},assetConfig:{not_found_handling:'single-page-application'}},
  d1Databases:['DB'],durableObjects:{SCHOOL_SERVICE:{className:'LitricSchoolService',useSQLite:true}},
  bindings:{LITRIC_AUTH_MODE:'standalone',LITRIC_BOOTSTRAP_HASH:await sha(setup),LITRIC_BOOTSTRAP_EXPIRES_AT:String(Date.now()+600_000)},
});
let browser;
const results={scope:'Local ephemeral Worker/D1 with synthetic AINS fixtures only. No catalogue fixtures; not production verification.',viewports:[],mascotStates:[],axe:[]};
try {
  const origin=(await mf.ready).origin;
  const db=await mf.getD1Database('DB');
  for(const file of fs.readdirSync(root+'/standalone/migrations').sort()) {
    const sql=fs.readFileSync(root+'/standalone/migrations/'+file,'utf8').replaceAll('--> statement-breakpoint','');
    await db.batch(sql.split(';').map(s=>s.trim()).filter(Boolean).map(s=>db.prepare(s)));
  }
  async function call(path,body,headers={}){
    const r=await mf.dispatchFetch(origin+path,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)});
    assert.equal(r.status,200,'local setup request status');return r.json();
  }
  await call('/api/auth/bootstrap',{password:temporary},{'X-Litric-Setup-Key':setup});
  const login=await call('/api/auth/login',{username:'GPM',password:temporary});
  await call('/api/auth/password',{currentPassword:temporary,password},{Authorization:'Bearer '+login.token});
  browser=await chromium.launch({executablePath:executable,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  const context=await browser.newContext({viewport:{width:1440,height:1100},reducedMotion:'reduce'});
  const page=await context.newPage();
  const errors=[];page.on('pageerror',error=>errors.push(error.name));
  const outbound=[];
  page.on('request',request=>{if(!request.url().startsWith(origin+'/'))outbound.push(new URL(request.url()).origin);});
  await page.goto(origin+'/',{waitUntil:'networkidle'});
  await page.getByLabel('Nama pengguna',{exact:true}).fill('GPM');
  await page.locator('.standalone-login input[type="password"]').fill(password);
  await page.getByRole('button',{name:'Log masuk',exact:true}).click();
  await page.getByRole('tab',{name:/SMARTLIB Agent/}).click();
  await page.getByText('Not Configured — missing configuration',{exact:true}).waitFor();
  await page.screenshot({path:path.join(artifacts,'smartlib-agent-desktop.png'),fullPage:true});
  for(const title of ['SMARTLIB Connection','Analisis Bacaan AINS','Cadangan Buku SMARTLIB','Pinjaman Lewat','Pelan Galakan Membaca','Cadangan Tindakan Guru'])
    await page.getByRole('heading',{name:title,exact:true}).waitFor();
  await page.evaluate(()=>{
    window.__agentStates=[];
    const mascot=document.querySelector('.agent-mascot');
    window.__agentStates.push(mascot.dataset.state);
    new MutationObserver(()=>window.__agentStates.push(mascot.dataset.state)).observe(mascot,{attributes:true,attributeFilter:['data-state']});
  });
  await page.getByRole('button',{name:'Analisis AINS',exact:true}).click();
  await page.locator('.agent-state-completed').waitFor();
  await page.getByText('Tiada sumber AINS disahkan yang meliputi tempoh ini.',{exact:false}).waitFor();
  results.mascotStates=await page.evaluate(()=>[...new Set(window.__agentStates)]);
  assert.deepEqual(results.mascotStates,['standby','analyzing','completed']);
  const animation=await page.locator('.agent-robot').evaluate(el=>getComputedStyle(el).animationName);
  assert.equal(animation,'none');results.reducedMotion=true;
  // Add test-only AINS records to the isolated database. Responses still come
  // from the real local handler; no API or catalogue response is mocked.
  const owner=await db.prepare("SELECT user_id FROM auth_accounts WHERE username='GPM'").first();
  const at=new Date().toISOString();
  await db.batch([
    db.prepare('INSERT INTO classes(id,school_id,name,year) VALUES (?,?,?,?)').bind('browser-class','ABA6052','KELAS SINTETIK BROWSER',2025),
    ...['reader','followup'].map(id=>db.prepare('INSERT INTO students(id,school_id,name,class_id,academic_year,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)').bind(id,'ABA6052','MURID SINTETIK BROWSER '+id,'browser-class',2025,'current',at,at)),
    db.prepare('INSERT INTO import_batches(id,school_id,dataset,filename,fingerprint,source_type,granularity,year,period_start,period_end,verification,coverage_complete,star_eligible,status,stats,created_by,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind('browser-batch','ABA6052','QA-SYNTHETIC','QA_SYNTHETIC.xlsx','qa-browser-fingerprint','XLSX','annual',2025,'2025-01-01','2025-12-31','verified',1,1,'active','{}',owner.user_id,at),
    db.prepare('INSERT INTO ains_summaries(id,school_id,batch_id,student_id,original_school,original_name,row_number,row_hash,approved,rejected,measures,raw,status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)').bind('browser-row','ABA6052','browser-batch','reader','ABA6052','MURID SINTETIK BROWSER reader',2,'qa-browser-row',4,0,'{}','{}','accepted'),
  ]);
  const snapshot=async()=>sha(JSON.stringify(await Promise.all(['students','ains_summaries','import_batches'].map(async table=>(await db.prepare(`SELECT * FROM ${table} ORDER BY id`).all()).results))));
  const beforeReview=await snapshot();
  await page.getByLabel('Dari',{exact:true}).fill('2025-01-01');
  await page.getByLabel('Hingga',{exact:true}).fill('2025-12-31');
  await page.getByRole('button',{name:'Pelan galakan membaca',exact:true}).click();
  const approve=page.getByRole('button',{name:'Sahkan semakan pelan',exact:true});
  await approve.waitFor();assert.equal(await approve.isDisabled(),true);
  await page.getByLabel('Saya telah menyemak bukti AINS dan kesesuaian pelan ini.',{exact:true}).check();
  await approve.click();
  await page.locator('.agent-plan-review [role="status"]').waitFor();
  assert.match(await page.locator('.agent-plan-review [role="status"]').innerText(),/Disemak oleh/);
  assert.equal(await snapshot(),beforeReview);results.teacherReview=true;results.permanentDataUnchanged=true;
  await page.evaluate(fs.readFileSync(require.resolve('axe-core/axe.min.js'),'utf8'));
  for(const width of [1440,768,390,320]){
    await page.setViewportSize({width,height:1000});
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);
    assert.equal(overflow,false,'horizontal overflow at '+width);
    results.viewports.push({width,horizontalOverflow:false});
    const axe=await page.evaluate(async()=>{
      const r=await window.axe.run(document.querySelector('#smartlib-agent-panel'),{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}});
      return r.violations.map(v=>({id:v.id,impact:v.impact,targets:v.nodes.map(n=>n.target)}));
    });
    results.axe.push({width,violations:axe});
    if(width===390)await page.screenshot({path:path.join(artifacts,'smartlib-agent-mobile.png'),fullPage:true});
  }
  await page.evaluate(()=>document.documentElement.dataset.theme='dark');
  const dark=await page.evaluate(async()=>{
    const r=await window.axe.run(document.querySelector('#smartlib-agent-panel'),{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}});
    return r.violations.map(v=>({id:v.id,impact:v.impact,targets:v.nodes.map(n=>n.target)}));
  });
  results.axe.push({theme:'dark',width:320,violations:dark});
  await page.screenshot({path:path.join(artifacts,'smartlib-agent-dark.png'),fullPage:true});
  await page.getByLabel('Hingga',{exact:true}).fill('2025-11-30');
  assert.equal(await page.locator('.agent-plan-review').count(),0);results.reviewResetOnPeriodChange=true;
  await page.getByRole('tab',{name:/SMARTLIB Agent/}).focus();await page.keyboard.press('ArrowLeft');
  assert.equal(await page.getByRole('tab',{name:'Dashboard Analitik',exact:true}).getAttribute('aria-selected'),'true');
  results.keyboardTabs=true;results.externalRequests=outbound;results.browserErrors=errors;
  assert.deepEqual(outbound,[]);assert.deepEqual(errors,[]);
  results.success=results.axe.every(r=>r.violations.length===0);
  fs.writeFileSync(path.join(artifacts,'smartlib-agent-browser-results.json'),JSON.stringify(results,null,2));
  console.log(JSON.stringify({...results,artifacts},null,2));
  assert.equal(results.success,true,'Accessibility issues must be resolved');
} finally {await browser?.close();await mf.dispose();}
