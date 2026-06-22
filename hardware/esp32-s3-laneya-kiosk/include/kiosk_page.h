#pragma once

#include <pgmspace.h>

static const char KIOSK_PAGE_HTML[] PROGMEM = R"KIOSKHTML(<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<meta name="theme-color" content="#023c75">
<title>LaneYa คีออส</title>
<style>
:root{--navy:#023c75;--navy2:#034d96;--green:#55a87a;--bg:#eef4fb;--card:#fff;--muted:#5a6b7d;--danger:#dc3545;--ok:#198754}
*{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;background:linear-gradient(180deg,#f8fbff 0%,var(--bg) 40%,#e3edf8 100%);color:#1a2b3c}
.app{display:flex;flex-direction:column;height:100dvh;overflow:hidden}
.hdr{display:flex;align-items:center;justify-content:space-between;padding:14px 18px;background:var(--navy);color:#fff;box-shadow:0 2px 12px rgba(2,60,117,.25)}
.brand{display:flex;align-items:center;gap:12px}
.logo{width:42px;height:42px;border-radius:10px;background:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;color:var(--navy);font-size:1.1rem}
.title{font-size:clamp(1.2rem,3.5vw,1.65rem);font-weight:700}
.pill{font-size:.72rem;padding:6px 12px;border-radius:999px;background:rgba(255,255,255,.15);border:1px solid rgba(255,255,255,.25)}
.pill.ok{background:rgba(85,168,122,.25);border-color:rgba(85,168,122,.5)}
.pill.bad{background:rgba(220,53,69,.25);border-color:rgba(220,53,69,.5)}
.emg{background:var(--danger);color:#fff;text-align:center;padding:10px 14px;font-size:clamp(.78rem,2.5vw,.92rem);line-height:1.45}
.main{flex:1;min-height:0;overflow:auto;padding:16px;display:flex;flex-direction:column;align-items:center;justify-content:center}
.card{background:var(--card);border-radius:20px;padding:24px;max-width:560px;width:100%;box-shadow:0 8px 32px rgba(2,60,117,.1);text-align:center}
.caption{font-size:clamp(1rem,2.8vw,1.12rem);line-height:1.65;color:var(--muted);margin:14px 0 18px}
.btn{display:block;width:100%;border:0;border-radius:16px;padding:18px 20px;font-size:clamp(1.05rem,3.2vw,1.25rem);font-weight:700;cursor:pointer;transition:transform .15s,opacity .15s}
.btn:active{transform:scale(.98)}
.btn-primary{background:var(--navy);color:#fff;box-shadow:0 6px 20px rgba(2,60,117,.35)}
.btn-primary:disabled{background:#7ba3cc;cursor:not-allowed;box-shadow:none}
.btn-ghost{background:#e9eef5;color:#334155}
.scan-wrap{position:relative;width:100%;max-width:560px;border-radius:20px;overflow:hidden;background:#0a1628;box-shadow:0 12px 40px rgba(2,60,117,.2);aspect-ratio:16/10}
.scan-wrap img{width:100%;height:100%;object-fit:cover;display:block;background:#111}
.scan-placeholder{display:flex;align-items:center;justify-content:center;height:100%;min-height:200px;color:#94a3b8;font-size:1rem;padding:20px;text-align:center}
.scan-overlay{position:absolute;inset:0;pointer-events:none}
.corner{position:absolute;width:28px;height:28px;border:3px solid var(--green)}
.corner.tl{top:16px;left:16px;border-right:0;border-bottom:0;border-radius:6px 0 0 0}
.corner.tr{top:16px;right:16px;border-left:0;border-bottom:0;border-radius:0 6px 0 0}
.corner.bl{bottom:16px;left:16px;border-right:0;border-top:0;border-radius:0 0 0 6px}
.corner.br{bottom:16px;right:16px;border-left:0;border-top:0;border-radius:0 0 6px 0}
.scan-line{position:absolute;left:8%;right:8%;height:2px;background:linear-gradient(90deg,transparent,var(--green),transparent);animation:scan 2s ease-in-out infinite;top:20%}
@keyframes scan{0%,100%{top:18%;opacity:.4}50%{top:78%;opacity:1}}
.scan-meta{margin-top:14px;text-align:center;width:100%;max-width:560px}
.count{font-size:clamp(2.5rem,8vw,3.5rem);font-weight:800;color:var(--navy);line-height:1}
.count-label{color:var(--muted);font-size:1rem;margin-top:4px}
.status{font-size:1rem;margin:8px 0;color:var(--muted)}
.status.bad{color:var(--danger);font-weight:600}
.preview{width:100%;max-width:560px}
.preview .card{text-align:left;margin-bottom:12px}
.preview h2{font-size:1.05rem;color:var(--navy);margin-bottom:8px;font-weight:700}
.preview p{line-height:1.6;color:#334155}
.drug-card{display:flex;flex-direction:column;align-items:center;gap:12px;padding:20px}
.drug-name{font-size:clamp(1.2rem,3.5vw,1.5rem);font-weight:800;color:var(--navy);text-align:center}
.pill-icon{width:72px;height:72px;border-radius:50%;background:linear-gradient(135deg,#e8f0fa,#d4e4f7);display:flex;align-items:center;justify-content:center;font-size:2rem}
.warn{border:2px solid var(--danger);background:#fff5f5;border-radius:14px;padding:16px;margin-top:8px}
.warn h2{color:var(--danger);font-size:.95rem;margin-bottom:6px}
.foot{display:flex;gap:12px;padding:14px 16px;background:#fff;border-top:1px solid #dbe4ef;box-shadow:0 -4px 16px rgba(0,0,0,.04)}
.foot .btn{flex:1;margin:0}
.foot.scan-only .btn-primary{display:none!important}
.foot.scan-only .btn-ghost{flex:1;width:100%}
.hidden{display:none!important}
.state-icon{font-size:3rem;margin-bottom:12px}
.center{text-align:center;font-size:clamp(1.1rem,3vw,1.3rem);font-weight:600;padding:20px}
.ok{color:var(--ok)}.err{color:var(--danger)}
.hint{font-size:.85rem;color:var(--muted);margin-top:14px;line-height:1.55}
.code-or{font-size:.9rem;color:var(--muted);margin:16px 0 8px}
.code-input{width:100%;border:2px solid #dbe4ef;border-radius:12px;padding:14px;font-size:1.05rem;font-family:ui-monospace,monospace;text-align:center;letter-spacing:.04em;margin:8px 0;text-transform:uppercase}
.code-input:focus{outline:none;border-color:var(--navy)}
.guide{margin:0 auto 8px;max-width:280px;width:70%}
.guide svg{width:100%;height:auto}
</style>
</head>
<body>
<div class="app">
<header class="hdr">
<div class="brand"><div class="logo">LY</div><div class="title">LaneYa คีออส</div></div>
<span class="pill" id="camPill">กล้อง …</span>
</header>
<div class="emg">หากท่านมีอาการป่วยฉุกเฉินรุนแรง (เช่น แน่นหน้าอก, หายใจไม่ออก, หมดสติ) โปรดอย่าใช้ตู้นี้ และโทรสายด่วน <strong>1669</strong> ทันที</div>
<main class="main" id="main"></main>
<footer class="foot hidden" id="foot">
<button class="btn btn-ghost" id="btnCancel" type="button">ยกเลิก</button>
<button class="btn btn-primary" id="btnConfirm" type="button">ยืนยันรับยา</button>
</footer>
</div>
<script>
const ERR={"preview failed":"ไม่สามารถตรวจสอบตั๋วได้ — ตรวจว่าตั๋วยังไม่หมดอายุ","ticket expired":"ตั๋วหมดอายุแล้ว — ขอ QR ใหม่จากแชท","unauthorized":"ระบบตู้ไม่ได้รับอนุญาต — ตรวจ KIOSK_HEARTBEAT_SECRET","ticket not found":"ไม่พบตั๋วในระบบ","cam offline":"กล้องไม่ตอบ PING","cam peer not ready":"กล้องยังไม่พร้อม — ตรวจ MAC","scan timeout":"หมดเวลาสแกน — ถือ QR ใกล้กล้อง","scan start failed":"เปิดกล้องไม่สำเร็จ","dispense failed":"จ่ายยาไม่สำเร็จ"};
function mapErr(e){return ERR[(e||"").toLowerCase()]||e||"เกิดข้อผิดพลาด กรุณาลองใหม่"}
async function api(p,m,b){const r=await fetch(p,{method:m||"GET",headers:{"Content-Type":"application/json"},body:b?JSON.stringify(b):undefined});if(!r.ok){let d="";try{d=(await r.json()).error||""}catch(_){}throw new Error(d||String(r.status))}return r.json()}
let busy=false,session={phase:"idle",countdownSec:0},camTimer=null;
const main=document.getElementById("main"),foot=document.getElementById("foot"),camPill=document.getElementById("camPill");
const btnCancel=document.getElementById("btnCancel"),btnConfirm=document.getElementById("btnConfirm");
const GUIDE='<div class="guide"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 280" fill="none"><rect x="40" y="20" width="120" height="200" rx="16" fill="#E8F0FA" stroke="#023c75" stroke-width="3"/><rect x="58" y="48" width="84" height="84" rx="8" fill="#fff" stroke="#023c75" stroke-width="2"/><rect x="68" y="58" width="20" height="20" fill="#023c75"/><rect x="92" y="58" width="20" height="20" fill="#023c75"/><rect x="116" y="58" width="20" height="20" fill="#023c75"/><rect x="68" y="82" width="20" height="20" fill="#023c75"/><rect x="116" y="82" width="20" height="20" fill="#023c75"/><rect x="68" y="106" width="20" height="20" fill="#023c75"/><rect x="92" y="106" width="20" height="20" fill="#023c75"/><rect x="116" y="106" width="20" height="20" fill="#023c75"/><path d="M160 120 L240 180" stroke="#55A87A" stroke-width="4" stroke-linecap="round"/><rect x="200" y="190" width="80" height="50" rx="8" fill="#023c75"/><rect x="210" y="200" width="60" height="8" rx="4" fill="#7dd3fc" opacity="0.8"/></svg></div>';
function stopCamPreview(){if(camTimer){clearInterval(camTimer);camTimer=null}}
function startCamPreview(url){stopCamPreview();if(!url)return;const img=document.getElementById("camLive");if(!img)return;const tick=()=>{img.src=url+(url.indexOf("?")>=0?"&":"?")+"t="+Date.now()};tick();camTimer=setInterval(tick,400)}
function updateCamPill(){if(session.camOnline===true){camPill.textContent="กล้องเชื่อมต่อ";camPill.className="pill ok"}else if(session.camOnline===false){camPill.textContent="กล้องไม่ตอบ";camPill.className="pill bad"}else{camPill.textContent="กล้อง …";camPill.className="pill"}}
function normalizeCode(raw){const c=(raw||"").trim().toUpperCase().replace(/[\s-]+/g,"");if(/^[AB][1-5]-\d{4}-[A-Z]{6}$/.test(c))return c;if(/^[AB][1-5]\d{4}[A-Z]{6}$/.test(c))return c.slice(0,2)+"-"+c.slice(2,6)+"-"+c.slice(6);return null}
function formatCodeLive(raw){const c=(raw||"").replace(/[^a-zA-Z0-9]/g,"").toUpperCase().slice(0,12);if(c.length<=2)return c;if(c.length<=6)return c.slice(0,2)+"-"+c.slice(2);return c.slice(0,2)+"-"+c.slice(2,6)+"-"+c.slice(6)}
function render(){
updateCamPill();const p=session.phase||"idle";
foot.classList.toggle("hidden",!(p==="preview"||p==="scanning"));
foot.classList.toggle("scan-only",p==="scanning");
btnConfirm.disabled=busy||p!=="preview"||ticketExpired();btnCancel.disabled=busy||p==="dispensing";
if(p!=="scanning")stopCamPreview();
if(p==="idle"){
main.innerHTML='<div class="card">'+GUIDE+'<p class="caption">หากท่านคัดกรองอาการผ่านมือถือเรียบร้อยแล้ว โปรดกดปุ่มด้านล่างเพื่อเปิดกล้องสแกนรับยา</p><button class="btn btn-primary" id="btnScan" type="button">🔍 กดตรงนี้เพื่อเปิดกล้องสแกน QR Code</button><p class="code-or">หรือ</p><p class="hint">พิมพ์รหัสจากแชท LaneYa</p><input class="code-input" id="codeInput" placeholder="A1-0001-ABCDEF" maxlength="14" autocapitalize="characters" autocomplete="off"><button class="btn btn-ghost" id="btnSubmitCode" type="button">ยืนยันรหัส</button></div>';
document.getElementById("btnScan").onclick=startScan;document.getElementById("btnSubmitCode").onclick=submitCode;const codeEl=document.getElementById("codeInput");if(codeEl)codeEl.oninput=function(){this.value=formatCodeLive(this.value)};return}
if(p==="scanning"){
const camWarn=session.camOnline===false?'<p class="status bad">กล้องยังไม่ตอบ — preview อาจไม่ขึ้น</p>':'';
main.innerHTML='<div class="scan-wrap"><img id="camLive" alt="กล้อง" onerror="this.style.display=\'none\';document.getElementById(\'ph\').classList.remove(\'hidden\')"><div id="ph" class="scan-placeholder hidden">กำลังเชื่อมกล้อง…</div><div class="scan-overlay"><div class="corner tl"></div><div class="corner tr"></div><div class="corner bl"></div><div class="corner br"></div><div class="scan-line"></div></div></div><div class="scan-meta"><div class="count">'+(session.countdownSec||0)+'</div><div class="count-label">วินาที — ถือ QR ในกรอบ</div>'+camWarn+'</div>';
if(session.camPreviewUrl)setTimeout(()=>startCamPreview(session.camPreviewUrl),50);
return}
if(p==="preview"&&session.preview&&session.preview.drug){
const d=session.preview.drug,w=[d.warnings,d.contraindications].filter(Boolean).join("\n\n"),exp=ticketExpired()?'<div class="warn"><p>ตั๋วหมดอายุแล้ว — ไม่สามารถรับยาได้</p></div>':'';
main.innerHTML=exp+'<div class="preview"><div class="card"><h2>ผลการวิเคราะห์</h2><p>'+(session.preview.sessionSummary||d.indication||"—")+'</p></div><div class="card drug-card"><div class="pill-icon">💊</div><div class="drug-name">'+d.name+'</div></div>'+(w?'<div class="warn"><h2>คำเตือน</h2><p style="white-space:pre-wrap">'+w+'</p></div>':"")+'</div>';return}
if(p==="dispensing"){main.innerHTML='<div class="card center"><div class="state-icon">⏳</div>กำลังจ่ายยา…</div>';return}
if(p==="success"){main.innerHTML='<div class="card center ok"><div class="state-icon">✅</div>รับยาสำเร็จ<br><span style="font-weight:400;font-size:1rem">ขอบคุณค่ะ</span></div>';return}
if(p==="error"){main.innerHTML='<div class="card center err"><div class="state-icon">⚠️</div>'+mapErr(session.error)+'</div><button class="btn btn-primary" style="margin-top:16px;max-width:320px" id="btnRetry" type="button">ลองใหม่</button>';document.getElementById("btnRetry").onclick=()=>api("/kiosk/scan/cancel","POST").then(refresh);return}
main.innerHTML='<div class="center">'+p+'</div>'}
async function refresh(){try{session=await api("/kiosk/session")}catch(e){session={phase:"error",error:"เชื่อมตู้ไม่ได้"}}render()}
async function startScan(){if(busy)return;busy=true;render();try{await api("/kiosk/scan/start","POST");await refresh()}catch(e){session={phase:"error",error:e.message};render()}finally{busy=false}}
async function submitCode(){if(busy)return;const el=document.getElementById("codeInput");const code=normalizeCode(el&&el.value);if(!code){session={phase:"error",error:"รูปแบบรหัสไม่ถูกต้อง"};render();return}busy=true;render();try{await api("/kiosk/submit-code","POST",{code});await refresh()}catch(e){session={phase:"error",error:e.message};render()}finally{busy=false}}
btnCancel.onclick=async()=>{if(busy)return;busy=true;try{await api("/kiosk/scan/cancel","POST");await refresh()}finally{busy=false}};
btnConfirm.onclick=async()=>{if(busy||ticketExpired())return;busy=true;try{await api("/kiosk/pickup/confirm","POST");await refresh()}catch(e){session={phase:"error",error:e.message};render()}finally{busy=false}};
setInterval(refresh,500);refresh();
</script>
</body>
</html>)KIOSKHTML";
