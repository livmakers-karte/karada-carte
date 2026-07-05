/* からだのカルテ 母屋 — config駆動レンダリング（外部ファイル化＝CSPから script unsafe-inline を排除） */
(function(){
  function txt(id,v){ var el=document.getElementById(id); if(el&&v!=null) el.textContent=v; }
  fetch('config.json?t=' + Date.now())
    .then(function(r){ if(!r.ok) throw new Error('config'); return r.json(); })
    .then(function(c){
      var h = c.home || {};
      document.title = (h.meta && h.meta.title) || document.title;
      txt('brandSub', c.site && c.site.sub);
      if (h.hero){
        txt('eyebrow', h.hero.eyebrow);
        if (h.hero.titleLines && h.hero.titleLines.length){
          document.getElementById('homeTitle').innerHTML =
            h.hero.titleLines.map(function(l,i){ return i===h.hero.titleLines.length-1 ? '<span class="nb">'+l+'</span>' : l; }).join('<br>');
        }
        txt('homeLead', h.hero.lead);
      }
      txt('featureLabel', h.featureLabel);
      txt('growLabel', h.growLabel);
      txt('homeNote', h.note);
      if (h.feature){
        var fc=document.getElementById('featureCard'); if(h.feature.href) fc.setAttribute('href', h.feature.href);
        txt('featureBadge', h.feature.badge);
        txt('featureTitle', h.feature.title);
        txt('featureDesc', h.feature.desc);
        txt('featureMeta', h.feature.meta);
      }
      // tiles
      var box=document.getElementById('tiles'); box.innerHTML='';
      (h.tiles||[]).forEach(function(t){
        var d=document.createElement('div'); d.className='tile';
        d.innerHTML='<svg class="ic" aria-hidden="true"><use href="#'+(t.icon||'ic-mineral')+'"/></svg>'+
          '<p class="t">'+t.title+'</p><p class="d">'+t.desc+'</p><span class="st">'+(t.status||'準備中')+'</span>';
        box.appendChild(d);
      });
      // 母屋FAQ（可視 + FAQPage schema）
      txt('homeFaqLabel', h.faqLabel);
      var fl=document.getElementById('homeFaqList');
      if (fl && h.faq && h.faq.length){
        fl.innerHTML='';
        h.faq.forEach(function(f){ var d=document.createElement('details'); d.innerHTML='<summary>'+f.q+'</summary><div class="a">'+f.a+'</div>'; fl.appendChild(d); });
        var faqLd={ "@context":"https://schema.org","@type":"FAQPage","mainEntity":
          h.faq.map(function(f){ return {"@type":"Question","name":f.q,"acceptedAnswer":{"@type":"Answer","text":f.a}}; }) };
        var lf=document.getElementById('ld-faq'); if(lf) lf.textContent=JSON.stringify(faqLd);
      }
      // Organization JSON-LD（本文と一致する org 情報）
      if (h.org){
        var org={ "@context":"https://schema.org","@type":"Organization",
          "name":h.org.name||"からだのカルテ","url":h.org.url||"https://karada-carte.jp/",
          "description":h.org.description||"" };
        if (h.org.legalName && h.org.legalName.indexOf('__')!==0) org.legalName=h.org.legalName;
        document.getElementById('ld-org').textContent=JSON.stringify(org);
      }
    })
    .catch(function(e){
      document.getElementById('homeLead').textContent='設定ファイルの読み込みに失敗しました。時間をおいて再度お試しください。';
      console.error(e);
    });
  document.getElementById('year').textContent=String(new Date().getFullYear());
})();
// frame-busting（クリックジャッキング対策）
try{ if(window.top!==window.self){ window.top.location=window.self.location; } }catch(e){ document.documentElement.style.display='none'; }
