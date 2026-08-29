import { chromium } from 'playwright';
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--disable-background-networking','--no-first-run']});
const ctx=await b.newContext({viewport:{width:1440,height:900}});
const page=await ctx.newPage();
await page.goto('http://localhost:4321/',{waitUntil:'networkidle'});
await page.evaluate(()=>document.querySelectorAll('.reveal').forEach(e=>e.classList.add('is-in')));
await page.waitForTimeout(1000);
await page.click('[data-lightbox="0"]');
await page.waitForTimeout(900);
const out=await page.evaluate(()=>{
  const parse=c=>{
    if(c.startsWith('color(')){const m=c.match(/[\d.]+/g).map(Number);return {r:m[0]*255,g:m[1]*255,b:m[2]*255,a:m.length>3?m[3]:1};}
    const m=c.match(/[\d.]+/g).map(Number);return {r:m[0],g:m[1],b:m[2],a:m.length>3?m[3]:1};};
  const over=(fg,bg)=>({r:fg.r*fg.a+bg.r*(1-fg.a),g:fg.g*fg.a+bg.g*(1-fg.a),b:fg.b*fg.a+bg.b*(1-fg.a),a:1});
  const L=c=>{const f=v=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4);};return 0.2126*f(c.r)+0.7152*f(c.g)+0.0722*f(c.b);};
  const ratio=(a,b)=>{const l1=L(a),l2=L(b);return (Math.max(l1,l2)+0.05)/(Math.min(l1,l2)+0.05);};
  const hex=c=>'#'+[c.r,c.g,c.b].map(v=>Math.round(v).toString(16).padStart(2,'0')).join('');
  const effBg=(el,extra)=>{
    let stack=[]; let n=el;
    while(n && n.nodeType===1){ const cs=getComputedStyle(n); const bg=parse(cs.backgroundColor); if(bg.a>0) stack.push(bg); n=n.parentElement; }
    if(extra) stack=stack.concat(extra.map(parse));
    stack.push({r:255,g:255,b:255,a:1});
    let acc=stack[stack.length-1];
    for(let i=stack.length-2;i>=0;i--) acc=over(stack[i],acc);
    return acc;
  };
  const rows=[];
  const add=(label,sel,extraBelow)=>{
    const el=document.querySelector(sel); if(!el){rows.push({label,sel,err:'NOT FOUND'});return;}
    const cs=getComputedStyle(el);
    const fg=parse(cs.color);
    let bg=effBg(el.parentElement||el, extraBelow);
    const f=over(fg,bg);
    const px=parseFloat(cs.fontSize), w=cs.fontWeight;
    const large = px>=24 || (px>=18.66 && Number(w)>=700);
    const r=ratio(f,bg);
    rows.push({label,fg:hex(f),bg:hex(bg),px,weight:w,ratio:+r.toFixed(2),large,AA: r>=(large?3:4.5)?'PASS':'FAIL', text:(el.textContent||'').trim().slice(0,32)});
  };
  const SCRIM=['rgba(12,13,15,0.94)','rgb(244,242,237)'];
  add('body copy (p.prose)','#gathering p.prose');
  add('.lede','.lede');
  add('.label 11px','.hero .label');
  add('.sec-head__num','.sec-head__num');
  add('.shot__cap','.shot__cap');
  add('.shot__cat','.shot__cat');
  add('.tables__num','.tables__num');
  add('.tables__host','.tables__host');
  add('.tables__theme','.tables__theme');
  add('.hero__cap','.hero__cap span');
  add('.grounded__meta','.grounded__meta');
  add('.foot__sub','.foot__sub');
  add('.foot__fine','.foot__fine');
  add('.foot__top','.foot__top');
  add('masthead .wordmark__sub','.wordmark__sub');
  add('masthead .wordmark__soft','.wordmark__soft');
  add('masthead nav a','.masthead__nav a');
  add('masthead official','.masthead__official');
  add('night .label','.on-night .label');
  add('night body copy','#notes p.prose');
  add('night .note__b','.note__b');
  add('night .notes__cap','.notes__cap');
  add('night .sec-head__num','.on-night .sec-head__num');
  add('lb .lb__count','.lb__count',SCRIM);
  add('lb .lb__close','.lb__close',SCRIM);
  add('lb .lb__caption','.lb__caption',SCRIM);
  add('lb .lb__note','.lb__note',SCRIM);
  add('lb .lb__nav arrow','.lb__nav',SCRIM);
  add('lb close border','.lb__close',SCRIM);
  // focus ring contrast: pine vs paper, pine-bright vs night, pine vs scrim
  const ring=(name,col,bg)=>rows.push({label:'FOCUS RING '+name,fg:col,bg:bg,ratio:+ratio(parse(col),parse(bg)).toFixed(2),AA:ratio(parse(col),parse(bg))>=3?'PASS(3:1)':'FAIL(<3:1)'});
  ring('--pine on paper','rgb(29,75,67)','rgb(244,242,237)');
  ring('--pine-bright on night','rgb(127,179,166)','rgb(16,18,21)');
  ring('--pine on lightbox scrim','rgb(29,75,67)','rgb(26,27,29)');
  return rows;
});
for(const r of out) console.log(JSON.stringify(r));
await b.close();
