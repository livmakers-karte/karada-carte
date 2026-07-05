/* =========================================================================
   からだのカルテ — 薄毛・頭皮環境チェック
   - 採点・タイプ判定は全てブラウザ内（外部API・生成AIを呼ばない＝継続課金ゼロ）
   - ロジックの根拠・簡略化・薬機法の前提は README.md / config.json / 本コメントに明記
   ---------------------------------------------------------------------------
   採点：各設問の選択肢は4軸（内的/頭皮/栄養/生活）に weight(0-3) を持つ。
     軸ごと raw=選択weight合計、max=各設問の最大weight合計 → riskPct=raw/max*100
     環境スコア(目安)=100 - 全軸合算riskPct、clampで極端値を丸める（高いほど健やか傾向）
   タイプ判定：性別で候補軸を調整（男性は栄養軸をインナーケア=内的へ一部寄せVerde除外／
     女性は栄養軸=Verde候補）。閾値超えの軸が2つ以上→複合型、1つ→その軸型、
     生活軸が高く1軸該当なら複合寄り、該当なしは最大軸を採用。
   ※本ツールは「傾向の目安」。医療診断ではなく、効果効能を保証しない（薬機法）。
   ========================================================================= */
var CONFIG=null, DG=null, STATE={answers:{}}, STEP=0, MAX_STEP=0, lastResult=null;
var PAGE_START=Date.now(); /* 送信までの経過時間（bot対策・最短送信時間チェック用） */

function txt(id,v){var el=document.getElementById(id); if(el&&v!=null) el.textContent=v;}
function ph(v){return typeof v==='string' && v.indexOf('__')===0;} /* 未設定プレースホルダ判定 */
function num2(n){return String(n<10?'0'+n:n);}

/* ---------- 採点 ---------- */
function axisMaxes(){
  var mx={internal:0,scalp:0,nutrition:0,lifestyle:0};
  DG.steps.forEach(function(st){ st.questions.forEach(function(q){
    var per={internal:0,scalp:0,nutrition:0,lifestyle:0};
    (q.options||[]).forEach(function(o){ for(var k in per){ if(o.w&&o.w[k]!=null) per[k]=Math.max(per[k],o.w[k]); } });
    for(var k in mx) mx[k]+=per[k];
  });});
  return mx;
}
function compute(){
  var raw={internal:0,scalp:0,nutrition:0,lifestyle:0};
  DG.steps.forEach(function(st){ st.questions.forEach(function(q){
    var a=STATE.answers[q.id]; if(a&&a.w){ for(var k in raw){ if(a.w[k]!=null) raw[k]+=a.w[k]; } }
  });});
  var mx=axisMaxes();
  var risk={}, totalRaw=0, totalMax=0;
  for(var k in raw){ risk[k]=mx[k]>0?(raw[k]/mx[k]*100):0; totalRaw+=raw[k]; totalMax+=mx[k]; }
  var sc=DG.scoring;
  var score=Math.round(100 - (totalMax>0?totalRaw/totalMax*100:0));
  score=Math.max(sc.scoreClampMin, Math.min(sc.scoreClampMax, score));

  var gender=(STATE.answers.gender||{}).v || 'male';
  var age=(STATE.answers.age||{}).v || '';
  var r={internal:risk.internal, scalp:risk.scalp, nutrition:risk.nutrition, lifestyle:risk.lifestyle};
  var core;
  if(gender==='male'){ r.internal=Math.min(100, r.internal + r.nutrition*0.5); core=['internal','scalp']; }
  else { core=['internal','scalp','nutrition']; }
  var th=sc.highThreshold;
  var highs=core.filter(function(a){return r[a]>=th;});
  var lifeHigh=r.lifestyle>=th;
  var type;
  if(highs.length>=sc.complexMinHighAxes) type='complex';
  else if(highs.length===1 && lifeHigh && sc.lifestyleAmplifies) type='complex';
  else if(highs.length===1) type=highs[0];
  else type=core.reduce(function(a,b){return r[b]>r[a]?b:a;}, core[0]);

  return {score:score, risk:risk, type:type, dominant:core.reduce(function(a,b){return r[b]>r[a]?b:a;},core[0]),
    gender:gender, age:age};
}
function cfg(){return DG.scoring;}

/* ---------- カルテ番号（発行の記録性） ---------- */
function karteNumber(res){
  var d=new Date();
  var ds=d.getFullYear()+num2(d.getMonth()+1)+num2(d.getDate());
  var seed=res.type+res.score+res.gender+res.age+JSON.stringify(Object.keys(STATE.answers).map(function(k){return STATE.answers[k].v;}));
  var h=0; for(var i=0;i<seed.length;i++){ h=(h*31+seed.charCodeAt(i))>>>0; }
  var code=('000'+(h%10000)).slice(-4);
  return {no:'KRD-'+ds+'-'+code, date:d.getFullYear()+'.'+num2(d.getMonth()+1)+'.'+num2(d.getDate())};
}

/* ---------- ステップUI ---------- */
function renderSteps(){
  var host=document.getElementById('steps'); host.innerHTML='';
  DG.steps.forEach(function(st,si){
    var div=document.createElement('div'); div.className='step'; div.setAttribute('data-step',si); if(si!==0) div.hidden=true;
    var html='<p class="steplabel">STEP '+(si+1)+' / '+DG.steps.length+' ・ '+st.label+'</p>'+
             '<h3>'+st.title+'</h3>'+(st.hint?'<p class="hint">'+st.hint+'</p>':'');
    st.questions.forEach(function(q){
      var two=(q.options.length<=2)?' two':'';
      html+='<fieldset class="q"><legend class="ql">'+q.q+'</legend><div class="opts'+two+'" data-q="'+q.id+'">';
      q.options.forEach(function(o){
        html+='<label class="opt"><input type="radio" name="'+q.id+'" value="'+o.v+'"><span class="t">'+o.label+'</span></label>';
      });
      html+='</div></fieldset>';
    });
    html+='<div class="err" id="err'+si+'"></div>';
    div.innerHTML=html; host.appendChild(div);
  });
  // bind options
  DG.steps.forEach(function(st){ st.questions.forEach(function(q){
    var box=document.querySelector('.opts[data-q="'+q.id+'"]');
    box.querySelectorAll('input').forEach(function(inp){
      inp.addEventListener('change', function(){
        var opt=null; q.options.forEach(function(o){ if(o.v===inp.value) opt=o; });
        STATE.answers[q.id]={v:inp.value, w:opt?opt.w:{}};
        box.querySelectorAll('.opt').forEach(function(l){l.classList.remove('sel');});
        inp.closest('.opt').classList.add('sel');
        validateStep();
      });
    });
  });});
  MAX_STEP=DG.steps.length-1;
}
function renderStepbar(){
  var bar=document.getElementById('stepbar'); bar.innerHTML='';
  for(var i=0;i<=MAX_STEP;i++){ var s=document.createElement('div'); s.className='seg'+(i<STEP?' done':'')+(i===STEP?' on':''); bar.appendChild(s); }
}
function showStep(n,noScroll){
  STEP=n; renderStepbar();
  document.querySelectorAll('.step').forEach(function(s){ s.hidden=(Number(s.getAttribute('data-step'))!==n); });
  document.getElementById('btnBack').style.visibility=n===0?'hidden':'visible';
  document.getElementById('btnNext').textContent=(n===MAX_STEP)?'カルテを発行する →':'次へ';
  validateStep();
  if(!noScroll) document.getElementById('wizard').scrollIntoView({behavior:'smooth',block:'start'});
}
function validateStep(show){
  var st=DG.steps[STEP], ok=true;
  st.questions.forEach(function(q){ if(!STATE.answers[q.id]) ok=false; });
  var e=document.getElementById('err'+STEP); if(e) e.textContent = (!ok&&show)?'すべての項目をお選びください。':'';
  document.getElementById('btnNext').disabled=!ok;
  return ok;
}

/* ---------- 結果（カルテ票）描画 ---------- */
var AXORDER=[['internal','内的要因'],['scalp','頭皮環境'],['nutrition','栄養・ダメージ'],['lifestyle','生活習慣']];
function renderResult(){
  var res=compute(); lastResult=res;
  var t=CONFIG.usuge.types[res.type];
  document.getElementById('wizard').style.display='none';
  var rw=document.getElementById('resultwrap'); rw.style.display='block';

  var kn=karteNumber(res);
  txt('karteNo',kn.no); txt('karteDate',kn.date);

  // score
  document.getElementById('scoreVal').textContent=res.score;
  setTimeout(function(){
    document.getElementById('scoreFill').style.width=res.score+'%';
    document.getElementById('scoreMk').style.left=res.score+'%';
  },60);

  // prev delta（URL ?prev=NN で前回スコアがあれば比較）
  var params=new URLSearchParams(location.search);
  var prev=parseInt(params.get('prev'),10);
  if(!isNaN(prev)){
    var d=res.score-prev, sign=d>0?'+':'';
    document.getElementById('prevDelta').style.display='block';
    document.getElementById('prevDelta').innerHTML='前回のカルテ '+prev+' → 今回 '+res.score+'（<b>'+sign+d+'</b>）';
  }

  // type + seal
  txt('sealText', t.seal); txt('typeName', t.name); txt('typeSub', t.sub);
  var stamp=document.getElementById('sealStamp');
  if(!matchMedia('(prefers-reduced-motion: reduce)').matches){ stamp.classList.remove('seal-anim'); void stamp.offsetWidth; stamp.classList.add('seal-anim'); }

  // axis bars
  var ab=document.getElementById('axisBars'); ab.innerHTML='';
  AXORDER.forEach(function(a){
    var key=a[0], val=Math.round(res.risk[key]);
    var dom=(key===res.dominant)?' dom':'';
    var row=document.createElement('div'); row.className='axis'+dom;
    row.innerHTML='<span class="an">'+a[1]+'</span><span class="at"><span class="af"></span></span><span class="av">'+val+'</span>';
    ab.appendChild(row);
    (function(fill,v){ setTimeout(function(){fill.style.width=v+'%';},80); })(row.querySelector('.af'),val);
  });

  // finding / cycle / approach
  txt('findingText', t.finding);
  var hc=CONFIG.usuge.hairCycle;
  txt('cycleTitle', hc.title); txt('cycleText', hc.text); txt('cycleNote', hc.note);
  txt('approachText', t.approach);

  // products
  var pbox=document.getElementById('products'); pbox.innerHTML='';
  var picons={boston:'ic-pill',shampoo:'ic-bottle',essence:'ic-drop',verde:'ic-leaf'};
  (t.products||[]).forEach(function(p){
    var ic=picons[p.urlKey]||'ic-leaf';
    var d=document.createElement('div'); d.className='prod';
    d.innerHTML='<span class="pi"><svg aria-hidden="true"><use href="#'+ic+'"/></svg></span>'+
      '<span><p class="pn">'+p.name+'</p><span class="pcat">'+p.category+'</span>'+
      '<p class="pd">'+p.ingredient+'</p><p class="pnote">'+p.note+'</p></span>';
    pbox.appendChild(d);
  });

  // disclaimer
  document.getElementById('resultDisclaimer').innerHTML='<strong>これは傾向の目安です。</strong> '+CONFIG.usuge.disclaimer.onResult+' '+CONFIG.usuge.disclaimer.yakkihou;

  // offer + CTAs
  var off=CONFIG.usuge.offer, es=CONFIG.esrosso;
  txt('offerTitle', off.title); txt('offerLead', off.lead);
  txt('guaranteeBadge', '◎ '+(es.guarantee?es.guarantee.label:'全額返金保証'));
  var ctas=document.getElementById('offerCtas'); ctas.innerHTML='';
  var urls=CONFIG.usuge.productUrls||{};
  // ① タイプに接続した らくトク便(定期) 製品を主CTAに（複合型は2製品＝内外併用で客単価最大）
  (t.products||[]).forEach(function(p,i){
    var u=urls[p.urlKey];
    var label = (i===0) ? off.ctaRakutokuLabel : ('＋ '+p.name+'（らくトク便）');
    if(u && !ph(u)) ctas.appendChild(mkCta(label, u, i===0?'main':'ghost'));
    else ctas.appendChild(mkCta(label+'（準備中）', null, i===0?'main':'ghost'));
  });
  // ② 定期でなく単品で試す（低ハードル導線）
  if(off.entryUrl && !ph(off.entryUrl)) ctas.appendChild(mkCta(off.entryLabel||'単品で試す', off.entryUrl, 'ghost'));
  // ③ LINE（設定時のみ／未設定なら下部の再診断ブロックが受け皿）
  if(es.line && es.line.url && !ph(es.line.url)) ctas.appendChild(mkCta(off.ctaLineLabel, es.line.url, 'line'));
  if(off.microtrust){ var mt=document.createElement('p'); mt.className='small'; mt.style.cssText='color:#c3d2ca;text-align:center;margin:12px 0 0;font-size:11.5px'; mt.textContent=off.microtrust; ctas.appendChild(mt); }

  // recheck
  var rc=CONFIG.usuge.recheck;
  txt('recheckTitle', rc.title); txt('recheckText', rc.text);
  var rcc=document.getElementById('recheckCta'); rcc.textContent=rc.cta;
  if(es.line && es.line.url && !ph(es.line.url)){ rcc.className='ctabtn line'; rcc.setAttribute('href', es.line.url); }
  else { rcc.className='ctabtn main'; rcc.removeAttribute('target'); rcc.setAttribute('href','#formCard'); } /* LINE未設定時は再診断希望フォームへ誘導 */

  // hidden lead values（送信で営業/CRMへ渡る＝原因タイプ判定済みの見込み客）
  document.getElementById('hKarteNo').value=kn.no;
  document.getElementById('hType').value=t.name;
  document.getElementById('hScore').value=res.score;
  document.getElementById('hAxInternal').value=Math.round(res.risk.internal);
  document.getElementById('hAxScalp').value=Math.round(res.risk.scalp);
  document.getElementById('hAxNutrition').value=Math.round(res.risk.nutrition);
  document.getElementById('hAxLifestyle').value=Math.round(res.risk.lifestyle);
  document.getElementById('hGender').value=res.gender;
  document.getElementById('hAge').value=res.age;

  // URL に結果を保存（localStorage不使用・共有/再診断比較用）
  try{
    var q=new URLSearchParams(); q.set('type',res.type); q.set('score',res.score); q.set('kn',kn.no);
    history.replaceState(null,'', location.pathname+'?'+q.toString());
  }catch(e){}

  rw.scrollIntoView({behavior:'smooth',block:'start'});
}
function mkCta(label,href,cls){
  var a=document.createElement(href?'a':'button'); a.className='ctabtn '+cls; a.textContent=label;
  if(href){ a.setAttribute('href',href); a.setAttribute('target','_blank'); a.setAttribute('rel','noopener'); }
  else { a.type='button'; a.disabled=true; a.style.opacity='.55'; }
  return a;
}

/* ---------- 静的テキスト差し込み ---------- */
function hydrate(){
  var u=CONFIG.usuge;
  document.title=u.meta.title;
  txt('brandMark', CONFIG.site.name); txt('brandSub', u.brand.sub);
  // hero
  txt('heroEyebrow', u.hero.eyebrow); txt('heroLead', u.hero.lead); txt('heroMeta', u.hero.meta); txt('heroCta', u.hero.cta);
  if(u.hero.titleLines){ document.getElementById('heroTitle').innerHTML=u.hero.titleLines.map(function(l,i){return i===u.hero.titleLines.length-1?'<span class="nb accent">'+l+'</span>':l;}).join('<br>'); }
  txt('directAnswer', u.geo.directAnswer);
  // method
  txt('cycleIntro', u.hairCycle.text);
  txt('howToTitle', u.geo.howToTitle);
  var ol=document.getElementById('howToList'); ol.innerHTML=''; u.geo.howToSteps.forEach(function(s){var li=document.createElement('li');li.textContent=s;ol.appendChild(li);});
  txt('methodDisclaimer', u.disclaimer.short+' '+u.disclaimer.yakkihou);
  // faq
  var fl=document.getElementById('faqList'); fl.innerHTML=''; u.geo.faq.forEach(function(f){var d=document.createElement('details');d.innerHTML='<summary>'+f.q+'</summary><div class="a">'+f.a+'</div>';fl.appendChild(d);});
  // form
  txt('formTitle', u.form.title); txt('formBody', u.form.body);
  txt('lPurpose', u.form.purposeLabel);
  txt('lName', u.form.fields.name); txt('lEmail', u.form.fields.email); txt('lTel', u.form.fields.tel); txt('lMsg', u.form.fields.message);
  txt('consentLabel', u.form.consentLabel);
  txt('thanksTitle', u.thanks.title); txt('thanksBody', u.thanks.body);
  var pz=document.getElementById('purposes'); pz.innerHTML='';
  u.form.purposes.forEach(function(p){
    var lab=document.createElement('label'); lab.className='pchk';
    lab.innerHTML='<input type="checkbox" value="'+p.label+'"><span>'+p.label+'</span>';
    lab.querySelector('input').addEventListener('change',function(){ lab.classList.toggle('sel',this.checked); });
    pz.appendChild(lab);
  });
  // footer
  document.getElementById('year').textContent=String(new Date().getFullYear());
  txt('footDisclaimer', u.disclaimer.short+' '+u.form.privacyNote);
  document.getElementById('footBrand').innerHTML='<strong style="color:#fff">'+CONFIG.esrosso.brand+'</strong>　<span style="color:#c3d2ca">'+CONFIG.esrosso.tagline+'</span>';
  // JSON-LD（本文と一致）
  var faqLd={"@context":"https://schema.org","@type":"FAQPage","mainEntity":u.geo.faq.map(function(f){return {"@type":"Question","name":f.q,"acceptedAnswer":{"@type":"Answer","text":f.a}};})};
  document.getElementById('ld-faq').textContent=JSON.stringify(faqLd);
  var howLd={"@context":"https://schema.org","@type":"HowTo","name":u.geo.howToTitle,"step":u.geo.howToSteps.map(function(s,i){return {"@type":"HowToStep","position":i+1,"text":s};})};
  document.getElementById('ld-howto').textContent=JSON.stringify(howLd);
}

/* ---------- Turnstile ---------- */
function loadTurnstile(){
  var sk=CONFIG.gas.turnstileSitekey; if(!sk||ph(sk)) return;
  var s=document.createElement('script'); s.src='https://challenges.cloudflare.com/turnstile/v0/api.js'; s.async=true; s.defer=true;
  s.onload=function(){ try{ window.turnstile.render('#turnstile-holder',{sitekey:sk,theme:'light'});}catch(e){} };
  document.head.appendChild(s);
}

/* ---------- 送信 ---------- */
function submitLead(e){
  e.preventDefault();
  var errEl=document.getElementById('formErr'); errEl.textContent='';
  var f=document.getElementById('leadForm');
  if(f.website.value.trim()!==''){ showThanks(); return; } // honeypot
  if(!f.name.value.trim()||!f.email.value.trim()){ errEl.textContent='お名前とメールアドレスをご入力ください。'; return; }
  if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email.value.trim())){ errEl.textContent='メールアドレスの形式をご確認ください。'; return; }
  if(!document.getElementById('fConsent').checked){ errEl.textContent='プライバシーの取り扱いへの同意にチェックしてください。'; return; }
  var sk=CONFIG.gas.turnstileSitekey, needTs=sk&&!ph(sk);
  if(needTs){ var tk=document.querySelector('#turnstile-holder [name="cf-turnstile-response"]'); if(!tk||!tk.value){ errEl.textContent='セキュリティ認証（Turnstile）を完了してください。'; return; } }

  // purposes
  var ps=[]; document.querySelectorAll('#purposes input:checked').forEach(function(c){ps.push(c.value);});
  document.getElementById('hPurpose').value=ps.join(' / ')||'（未選択）';
  document.getElementById('hHost').value=location.hostname;
  document.getElementById('hUa').value=navigator.userAgent;
  document.getElementById('hElapsed').value=String(Date.now()-PAGE_START);

  var endpoint=CONFIG.gas.endpoint;
  var btn=document.getElementById('btnSubmit'); btn.disabled=true; btn.textContent='送信中…';
  if(!endpoint||ph(endpoint)){ console.warn('[karada-carte] GAS endpoint 未設定のため送信をスキップ。config.json の gas.endpoint を設定してください。'); showThanks(); return; }

  var fd=new FormData(f);
  fetch(endpoint,{method:'POST',body:fd,mode:'no-cors'}).then(function(){showThanks();}).catch(function(){showThanks();});
}
function showThanks(){
  document.getElementById('leadForm').style.display='none';
  document.getElementById('formTitle').style.display='none';
  document.getElementById('formBody').style.display='none';
  document.getElementById('thanks').style.display='block';
  document.getElementById('thanks').scrollIntoView({behavior:'smooth',block:'center'});
}

/* ---------- 起動 ---------- */
function bind(){
  document.getElementById('btnNext').addEventListener('click',function(){ if(!validateStep())return; if(STEP===MAX_STEP){renderResult();return;} showStep(STEP+1); });
  document.getElementById('btnBack').addEventListener('click',function(){ if(STEP>0) showStep(STEP-1); });
  document.getElementById('btnRedo').addEventListener('click',function(){ location.href=location.pathname; });
  document.getElementById('btnPrint').addEventListener('click',function(){ window.print(); });
  document.getElementById('leadForm').addEventListener('submit',submitLead);
}
(function init(){
  fetch('../config.json?t='+Date.now())
    .then(function(r){ if(!r.ok) throw new Error('config'); return r.json(); })
    .then(function(c){ CONFIG=c; DG=c.usuge.diagnosis; hydrate(); renderSteps(); bind(); loadTurnstile(); showStep(0,true); })
    .catch(function(err){ document.getElementById('steps').innerHTML='<p style="color:#B0432F">設定ファイル(config.json)の読み込みに失敗しました。時間をおいて再度お試しください。</p>'; console.error(err); });
})();
// frame-busting
try{ if(window.top!==window.self){ window.top.location=window.self.location; } }catch(e){ document.documentElement.style.display='none'; }
