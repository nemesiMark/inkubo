/* Rain Ink Tattoo – gestione cookie, ripresa dal sito Olimp.
   Alla prima visita compare una barra in fondo alla pagina con «Rifiuta» e «Accetta».
   Il sito usa solo cookie tecnici; l'unica cosa che dipende dalla scelta è la mappa animata
   della home (js/mappa.js), che contatta servizi esterni (Esri, OpenFreeMap).
   Se si accetta, la mappa parte da sola quando si arriva a «Dove siamo»; se si rifiuta,
   resta il riquadro «Mostra la mappa». «Gestione cookie» nel footer riapre la barra. */
(function(){
  var KEY='rainink_cookie_v1', OLD='rainink_mappa_ok';

  function getConsent(){
    try{
      var c=JSON.parse(localStorage.getItem(KEY));
      if(c)return c;
      // chi aveva già premuto «Mostra la mappa» con la versione precedente vale come «Accetta»
      if(localStorage.getItem(OLD)==='1'){c={maps:true,ts:Date.now()};localStorage.setItem(KEY,JSON.stringify(c));return c}
    }catch(e){}
    return null;
  }
  function setConsent(maps){try{localStorage.setItem(KEY,JSON.stringify({maps:!!maps,ts:Date.now()}));localStorage.removeItem(OLD)}catch(e){}}

  /* --- stile: barra nero inchiostro con linea rossa sopra, testo a sinistra e pulsanti a destra --- */
  var css='\
#ck-banner{position:fixed;left:0;right:0;bottom:0;z-index:9999;background:var(--inchiostro,#14110f);color:#fff;border-top:3px solid var(--red,#c4372a);box-shadow:0 -8px 30px rgba(20,17,15,.3);font:400 .9rem/1.55 var(--body,Arial,sans-serif)}\
#ck-banner .ck-in{max-width:1360px;margin:0 auto;padding:1rem 3.5rem;padding-bottom:calc(1rem + env(safe-area-inset-bottom,0px));display:flex;align-items:center;gap:1rem 2.5rem}\
#ck-banner .ck-txt{flex:1 1 auto;min-width:0;margin:0;max-width:none;color:#cfc6b9;font-size:.85rem}\
#ck-banner h2{display:inline;font:700 .85rem var(--head,Arial,sans-serif);letter-spacing:0;margin:0;color:#fff}\
#ck-banner .ck-row{display:flex;gap:.6rem;flex:0 0 auto}\
#ck-banner .ck-btn{min-width:120px;border:1.5px solid transparent;border-radius:999px;padding:.75rem 1.3rem;font:600 .85rem var(--body,Arial,sans-serif);cursor:pointer;\
background-image:linear-gradient(var(--red,#c4372a),var(--red,#c4372a));background-repeat:no-repeat;background-position:0 100%;background-size:100% 0%;transition:background-size .35s cubic-bezier(.16,1,.3,1),color .25s,border-color .25s}\
#ck-banner [data-ck=no]{background-color:transparent;color:#fff;border-color:rgba(243,237,227,.55)}\
#ck-banner [data-ck=yes]{background-color:var(--carta,#f3ede3);color:var(--inchiostro,#14110f)}\
#ck-banner .ck-btn:hover,#ck-banner .ck-btn:focus-visible{background-size:100% 100%;color:#fff;border-color:var(--red,#c4372a)}\
#ck-banner .ck-btn:focus-visible,#ck-banner a:focus-visible{outline:2px solid currentColor;outline-offset:3px}\
#ck-banner a{color:#fff;text-decoration:underline;text-underline-offset:3px;white-space:nowrap}\
#ck-banner.ck-attn{animation:ckAttn .7s ease 1s 2}\
@keyframes ckAttn{50%{background:#5a1610}}\
@media(prefers-reduced-motion:reduce){#ck-banner.ck-attn{animation:none}}\
@media(max-width:800px){#ck-banner .ck-in{flex-direction:column;align-items:stretch;padding:.9rem 1.2rem;padding-bottom:calc(.9rem + env(safe-area-inset-bottom,0px));gap:.8rem}#ck-banner .ck-btn{flex:1 1 0;min-width:0}}';
  var st=document.createElement('style');st.textContent=css;document.head.appendChild(st);

  /* --- mappa --- */
  function apply(){var c=getConsent();if(c&&c.maps&&window.raininkMappa)window.raininkMappa()}

  /* --- barra --- */
  /* Spazio in fondo alla pagina alto quanto la barra, così non copre il footer. */
  function padBody(){var b=document.getElementById('ck-banner');document.body.style.paddingBottom=b?b.offsetHeight+'px':''}
  window.addEventListener('resize',padBody);
  function closeBanner(){var b=document.getElementById('ck-banner');if(b)b.remove();padBody()}

  function choose(maps){
    var before=getConsent(), was=!!(before&&before.maps);
    setConsent(maps);closeBanner();
    // se si ritira il consenso con la mappa già caricata, si ricarica la pagina per staccarla
    if(was&&!maps&&document.querySelector('.map-anim.is-ok')){location.reload();return}
    apply();
  }

  function flash(b){b.classList.remove('ck-attn');void b.offsetWidth;b.classList.add('ck-attn')}

  /* La barra prende il nome del pulsante che la apre (es. «Gestione cookie»). */
  function openBanner(e){
    var t=(e&&e.currentTarget&&e.currentTarget.textContent.trim())||'Cookie';
    var old=document.getElementById('ck-banner');
    if(old){old.querySelector('h2').textContent=t+'.';flash(old);return}
    var b=document.createElement('div');
    b.id='ck-banner';b.setAttribute('role','region');b.setAttribute('aria-label','Cookie');
    b.innerHTML='<div class="ck-in"><div class="ck-txt"><h2></h2> Usiamo solo cookie tecnici. Se accetti, la mappa animata di «Dove siamo» si carica da sola (foto satellitari Esri e caratteri OpenFreeMap, servizi esterni). <a href="privacy.html">Privacy e cookie</a></div><div class="ck-row"><button type="button" class="ck-btn" data-ck="no">Rifiuta</button><button type="button" class="ck-btn" data-ck="yes">Accetta</button></div></div>';
    b.querySelector('h2').textContent=t+'.';
    b.querySelector('[data-ck=no]').addEventListener('click',function(){choose(false)});
    b.querySelector('[data-ck=yes]').addEventListener('click',function(){choose(true)});
    document.body.appendChild(b);padBody();
    if(window.ResizeObserver)new ResizeObserver(padBody).observe(b);
    flash(b);
  }

  function init(){
    var bs=document.querySelectorAll('.ck-open');
    for(var i=0;i<bs.length;i++)bs[i].addEventListener('click',openBanner);
    apply();
    if(!getConsent())openBanner();
  }

  window.raininkCookie={get:getConsent,accept:function(){choose(true)},open:openBanner};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
