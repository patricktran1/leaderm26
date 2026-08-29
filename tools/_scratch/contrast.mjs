import { chromium } from 'playwright';
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--disable-background-networking','--no-first-run']});
const ctx=await b.newContext({viewport:{width:1440,height:900}});
const page=await ctx.newPage();
await page.goto('http://localhost:4321/',{waitUntil:'networkidle'});
await page.evaluate(()=>document.querySelectorAll('.reveal').forEach(e=>e.classList.add('is-in')));
await page.waitForTimeout(1200);
await page.click('[data-lightbox="0"]');
await page.waitForTimeout(900);
const out=await page.evaluate(()=>{
  const parse=c=>{const m=c.match(/[\d.]+/g).map(Number);return {r:m[0],g:m[1],b:m[2],a:m.length>3?m[3]:1};};
  const over=(fg,bg)=>({r:fg.r*fg.a+bg.r*(1-fg.a),g:fg.g*fg.a+bg.g*(1-fg.a),b:fg.b*fg.a+bg.b*(1-fg.a),a:1});
  const L=c=>{const f=v=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4);};return 0.2126*f(c.r)+0.7152*f(c.g)+0.0722*f(c.b);};
  const ratio=(a,b)=>{const l1=L(a),l2=L(b);return (Math.max(l1,l2)+0.05)/(Math.min(l1,l2)+0.05);};
  const hex=c=>'#'+[c.r,c.g,c.b].map(v=>Math.round(v).toString(16).padStart(2,'0')).join('');
  const effBg=(el)=>{
    let stack=[]; let n=el;
    while(n && n.nodeType===1){ const cs=getComputedStyle(n); const bg=parse(cs.backgroundColor); if(bg.a>0) stack.push(bg); n=n.parentElement; }
    stack.push({r:255,g:255,b:255,a:1});
    let acc=stack[stack.length-1];
    for(let i=stack.length-2;i>=0;i--) acc=over(stack[i],acc);
    return acc;
  };
  const rows=[];
  const add=(label,sel,root=document)=>{
    const el=root.querySelector(sel); if(!el){rows.push({label,sel,err:'NOT FOUND'});return;}
    const cs=getComputedStyle(el);
    const fg=parse(cs.color);
    let bg=effBg(el.parentElement||el);
    const f=over(fg,bg);
    const px=parseFloat(cs.fontSize), w=cs.fontWeight;
    const large = px>=24 || (px>=18.66 && Number(w)>=700);
    const r=ratio(f,bg);
    rows.push({label,sel,fg:hex(f),bg:hex(bg),px,weight:w,ratio:+r.toFixed(2),large,passAA: r>= (large?3:4.5), text:(el.textContent||'').trim().slice(0,40)});
  };
  add('body copy .prose p','.prose p');
  add('.lede','.lede');
  add('.label (uppercase 11px)','.label');
  add('.sec-head__num','.sec-head__num');
  add('.shot__cap caption','.shot__cap');
  add('.shot__cat','.shot__cat');
  add('.tables__num','.tables__num');
  add('.tables__theme','.tables__theme');
  add('.tables__host','.tables__host');
  add('.tables__source','.tables__source');
  add('.hero__cap','.hero__cap span');
  add('.grounded__meta','.grounded__meta');
  add('.objective__d','.objective__d');
  add('.capability__v','.capability__v');
  add('.build__v','.build__v');
  add('.bio__body','.bio__body');
  add('.foot__sub','.foot__sub');
  add('.foot__fine','.foot__fine');
  add('.foot__top','.foot__top');
  add('.foot__mark','.foot__mark');
  add('.wordmark__sub','.wordmark__sub');
  add('.wordmark__soft','.wordmark__soft');
  add('.masthead__nav a','.masthead__nav a');
  add('.masthead__official','.masthead__official');
  add('.masthead__toggle','.masthead__toggle');
  add('.skip-link','.skip-link');
  add('.arrow-link (paper)','.invite__links .arrow-link');
  // night
  add('night .label','.on-night .label');
  add('night .prose p','.on-night .prose p');
  add('night .note__b','.note__b');
  add('night .note__t','.note__t');
  add('night .serif-note','.on-night .serif-note');
  add('night .notes__cap','.notes__cap');
  add('night .sec-head__num','.on-night .sec-head__num');
  add('night h2','.on-night .h2');
  // lightbox
  add('lb .lb__count','.lb__count');
  add('lb .lb__close','.lb__close');
  add('lb .lb__caption','.lb__caption');
  add('lb .lb__note','.lb__note');
  add('lb .lb__nav','.lb__nav');
  // index panel (open it)
  return rows;
});
console.log(JSON.stringify(out,null,0).replace(/\},\{/g,'}\n{'));
// index panel
await page.keyboard.press('Escape'); await page.waitForTimeout(400);
await ctx.close();
const ctx2=await b.newContext({viewport:{width:390,height:844}});
const p2=await ctx2.newPage();
await p2.goto('http://localhost:4321/',{waitUntil:'networkidle'});
await p2.click('[data-menu-open]'); await p2.waitForTimeout(600);
const r2=await p2.evaluate(()=>{
  const g=s=>{const e=document.querySelector(s); if(!e) return null; const cs=getComputedStyle(e); return {sel:s,color:cs.color,size:cs.fontSize,weight:cs.fontWeight,bg:getComputedStyle(document.querySelector('.index-panel')).backgroundColor};};
  return ['.index-panel__num','.index-panel__list a','.index-panel__close','.index-panel__official','.index-panel .label'].map(g);
});
console.log('INDEX PANEL', JSON.stringify(r2,null,1));
await b.close();
