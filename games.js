// ═══════════════════════════════════════════════════════
// games.js · Mystery Chat v3
// Snake (slower) · Tetris (spiced up) · 2048 (smooth) · Pong (silky)
// ═══════════════════════════════════════════════════════

export const GAMES = [
  { id: "snake",  title: "Snake",  icon: "🐍", desc: "Ешь, расти, не умирай" },
  { id: "tetris", title: "Tetris", icon: "🟦", desc: "Hold, Ghost, Level up!" },
  { id: "2048",   title: "2048",   icon: "🔢", desc: "Плавно складывай числа" },
  { id: "pong",   title: "Pong",   icon: "🏓", desc: "Идеальный пинг-понг" },
];

export const STOCK_AVATARS = [
  { id: "herobrine", name: "Herobrine", url: "https://minotar.net/helm/MHF_Herobrine/100.png" },
  { id: "steve",     name: "Steve",     url: "https://minotar.net/helm/MHF_Steve/100.png" },
  { id: "alex",      name: "Alex",      url: "https://minotar.net/helm/MHF_Alex/100.png" },
  { id: "blaze",     name: "Blaze",     url: "https://minotar.net/helm/MHF_Blaze/100.png" },
  { id: "enderman",  name: "Enderman",  url: "https://minotar.net/helm/MHF_Enderman/100.png" },
  { id: "creeper",   name: "Creeper",   url: "https://minotar.net/helm/MHF_Creeper/100.png" },
  { id: "zombie",    name: "Zombie",    url: "https://minotar.net/helm/MHF_Zombie/100.png" },
  { id: "spider",    name: "Spider",    url: "https://minotar.net/helm/MHF_CaveSpider/100.png" },
  { id: "notch",     name: "Notch",     url: "https://minotar.net/helm/Notch/100.png" },
  { id: "smashh",    name: "Smashh",    url: "https://minotar.net/helm/Smashh/100.png" },
];

// ── shared base CSS injected in every game ──
const BASE = `
*{margin:0;padding:0;box-sizing:border-box;-webkit-tap-highlight-color:transparent;user-select:none;}
body{background:#05060a;display:flex;flex-direction:column;align-items:center;
  justify-content:center;min-height:100dvh;font-family:'Courier New',monospace;
  color:#e8eaf0;overflow:hidden;touch-action:none;}
h1{color:#7c6fff;font-size:18px;margin-bottom:6px;letter-spacing:3px;text-align:center;}
.srow{display:flex;gap:12px;margin-bottom:8px;}
.sbox{background:rgba(124,111,255,.12);border:1px solid rgba(124,111,255,.25);
  border-radius:8px;padding:5px 13px;text-align:center;}
.sbox label{display:block;font-size:9px;color:#8892b0;letter-spacing:2px;text-transform:uppercase;}
.sbox span{color:#2dd4bf;font-size:15px;font-weight:bold;}
canvas{border:1px solid rgba(124,111,255,.3);border-radius:10px;display:block;touch-action:none;}
.ov{position:absolute;inset:0;background:rgba(5,6,10,.88);display:flex;flex-direction:column;
  align-items:center;justify-content:center;border-radius:10px;gap:10px;z-index:10;}
.ov h2{color:#f5d020;font-size:19px;letter-spacing:2px;}
.ov p{color:#8892b0;font-size:13px;}
.obtn{background:rgba(124,111,255,.25);border:1px solid #7c6fff;border-radius:8px;
  padding:10px 28px;color:#e8eaf0;font-size:14px;cursor:pointer;font-family:inherit;margin-top:4px;}
.obtn:active{background:rgba(124,111,255,.5);}
.ctls{display:none;margin-top:10px;gap:6px;}
@media(pointer:coarse){.ctls{display:flex;flex-wrap:wrap;justify-content:center;}}
.cb{background:rgba(124,111,255,.18);border:1px solid rgba(124,111,255,.3);border-radius:8px;
  padding:10px 14px;color:#e8eaf0;font-size:18px;cursor:pointer;min-width:46px;text-align:center;}
.cb:active{background:rgba(124,111,255,.45);}
`;

function blobUrl(html) {
  return URL.createObjectURL(new Blob([html], { type: "text/html" }));
}

// ══════════════════════════════════════════
// 🐍 SNAKE  — speed 130ms (was 100ms), smoother eyes
// ══════════════════════════════════════════
function createSnake() {
  return blobUrl(`<!DOCTYPE html><html><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<title>Snake</title><style>${BASE}
.wrap{position:relative;}
</style></head><body>
<h1>🐍 SNAKE</h1>
<div class="srow">
  <div class="sbox"><label>Счёт</label><span id="sc">0</span></div>
  <div class="sbox"><label>Рекорд</label><span id="hi" style="color:#f5d020">0</span></div>
  <div class="sbox"><label>Уровень</label><span id="lv">1</span></div>
</div>
<div class="wrap">
  <canvas id="c" width="280" height="280"></canvas>
  <div class="ov" id="ov">
    <h2>SNAKE</h2><p>Mystery Chat Edition</p>
    <p style="font-size:11px;color:#4a5568">Свайп или стрелки</p>
    <button class="obtn" id="sb">▶ Начать</button>
  </div>
</div>
<div class="ctls">
  <div style="display:grid;grid-template-columns:46px 46px 46px;grid-template-rows:46px 46px;gap:5px;">
    <div></div><button class="cb" id="bu">↑</button><div></div>
    <button class="cb" id="bl">←</button>
    <button class="cb" id="bd">↓</button>
    <button class="cb" id="br">→</button>
  </div>
</div>
<script>
const C=document.getElementById('c'),X=C.getContext('2d');
const COLS=20,ROWS=20,Z=14;
const WALL_COLOR='rgba(255,255,255,0.03)';
let snake,dir,ndir,food,bonus,score,hi=0,lvl,timer,alive=false,bonusTimer=0;
function rnd(n){return Math.floor(Math.random()*n);}
function freeCell(){
  let pos;
  do{pos={x:rnd(COLS),y:rnd(ROWS)};}
  while(snake.some(s=>s.x===pos.x&&s.y===pos.y));
  return pos;
}
function start(){
  snake=[{x:10,y:10},{x:9,y:10},{x:8,y:10}];
  dir={x:1,y:0};ndir={x:1,y:0};
  score=0;lvl=1;bonusTimer=0;bonus=null;alive=true;
  document.getElementById('sc').textContent=0;
  document.getElementById('lv').textContent=1;
  food=freeCell();
  document.getElementById('ov').style.display='none';
  clearInterval(timer);timer=setInterval(tick,130);
}
function tick(){
  dir={...ndir};
  const head={x:(snake[0].x+dir.x+COLS)%COLS,y:(snake[0].y+dir.y+ROWS)%ROWS};
  if(snake.some(s=>s.x===head.x&&s.y===head.y)){end();return;}
  snake.unshift(head);
  let grew=false;
  if(head.x===food.x&&head.y===food.y){
    score+=10*lvl;grew=true;food=freeCell();
    if(score%(50*lvl)===0){lvl=Math.min(lvl+1,8);clearInterval(timer);timer=setInterval(tick,Math.max(60,130-lvl*14));}
    if(rnd(4)===0){bonus=freeCell();bonus.pts=30;bonusTimer=40;}
  }
  if(bonus&&head.x===bonus.x&&head.y===bonus.y){score+=bonus.pts;grew=true;bonus=null;}
  if(bonus)bonusTimer--;
  if(bonusTimer<=0)bonus=null;
  if(!grew)snake.pop();
  document.getElementById('sc').textContent=score;
  document.getElementById('lv').textContent=lvl;
  if(score>hi){hi=score;document.getElementById('hi').textContent=hi;}
  draw();
}
function draw(){
  X.fillStyle='#05060a';X.fillRect(0,0,280,280);
  // dots
  X.fillStyle=WALL_COLOR;
  for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++)
    X.fillRect(c*Z+Z/2-1,r*Z+Z/2-1,2,2);
  // food pulse
  const p=0.7+0.3*Math.sin(Date.now()*.007);
  X.shadowColor='#f5d020';X.shadowBlur=14*p;
  X.fillStyle='#f5d020';
  X.beginPath();X.arc(food.x*Z+Z/2,food.y*Z+Z/2,Z/2-2,0,Math.PI*2);X.fill();
  // bonus food
  if(bonus){
    X.shadowColor='#fc8181';X.shadowBlur=18*p;
    X.fillStyle='#fc8181';
    X.beginPath();X.arc(bonus.x*Z+Z/2,bonus.y*Z+Z/2,Z/2-1,0,Math.PI*2);X.fill();
  }
  X.shadowBlur=0;
  // snake
  snake.forEach((s,i)=>{
    const t=i/snake.length;
    if(i===0){X.shadowColor='#7c6fff';X.shadowBlur=12;}
    const hue=260-t*80;
    X.fillStyle=i===0?'#7c6fff':`hsl(${hue},65%,${52-t*18}%)`;
    X.beginPath();X.roundRect(s.x*Z+1,s.y*Z+1,Z-2,Z-2,3);X.fill();
    X.shadowBlur=0;
    if(i===0){
      const ex=s.x*Z+Z/2+dir.x*3,ey=s.y*Z+Z/2+dir.y*3;
      X.fillStyle='#fff';
      [[dir.y*3,dir.x*3],[- dir.y*3,-dir.x*3]].forEach(([ox,oy])=>{
        X.beginPath();X.arc(ex+ox,ey+oy,2,0,Math.PI*2);X.fill();
      });
    }
  });
}
function end(){
  clearInterval(timer);alive=false;
  const ov=document.getElementById('ov');
  ov.innerHTML='<h2>GAME OVER</h2><p>Счёт: '+score+' · Ур. '+lvl+'</p><button class="obtn" onclick="start()">Заново</button>';
  ov.style.display='flex';
}
document.addEventListener('keydown',e=>{
  if(!alive&&(e.key==='Enter'||e.key===' ')){start();return;}
  const m={ArrowUp:{x:0,y:-1},ArrowDown:{x:0,y:1},ArrowLeft:{x:-1,y:0},ArrowRight:{x:1,y:0}};
  if(m[e.key]&&!(m[e.key].x===-dir.x&&m[e.key].y===-dir.y))ndir=m[e.key];
  e.preventDefault();
});
document.getElementById('sb').onclick=start;
document.getElementById('bu').onclick=()=>{if(dir.y!==1)ndir={x:0,y:-1};};
document.getElementById('bd').onclick=()=>{if(dir.y!==-1)ndir={x:0,y:1};};
document.getElementById('bl').onclick=()=>{if(dir.x!==1)ndir={x:-1,y:0};};
document.getElementById('br').onclick=()=>{if(dir.x!==-1)ndir={x:1,y:0};};
let ts=null;
C.addEventListener('touchstart',e=>{ts={x:e.touches[0].clientX,y:e.touches[0].clientY};e.preventDefault();},{passive:false});
C.addEventListener('touchend',e=>{
  if(!ts)return;
  const dx=e.changedTouches[0].clientX-ts.x,dy=e.changedTouches[0].clientY-ts.y;
  if(!alive){start();return;}
  if(Math.abs(dx)>Math.abs(dy)){if(dx>16&&dir.x!==-1)ndir={x:1,y:0};else if(dx<-16&&dir.x!==1)ndir={x:-1,y:0};}
  else{if(dy>16&&dir.y!==-1)ndir={x:0,y:1};else if(dy<-16&&dir.y!==1)ndir={x:0,y:-1};}
  ts=null;
},{passive:true});
X.fillStyle='#05060a';X.fillRect(0,0,280,280);
<\/script></body></html>`);
}

// ══════════════════════════════════════════
// 🟦 TETRIS — Hold piece, Ghost, level colors, combo
// ══════════════════════════════════════════
function createTetris() {
  return blobUrl(`<!DOCTYPE html><html><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<title>Tetris</title><style>${BASE}
.game-wrap{display:flex;gap:10px;align-items:flex-start;}
.side{display:flex;flex-direction:column;gap:8px;width:68px;}
.mini-label{font-size:9px;color:#8892b0;letter-spacing:1.5px;text-transform:uppercase;text-align:center;margin-bottom:3px;}
#hold-c,#next-c{border:1px solid rgba(124,111,255,.2);border-radius:6px;display:block;}
.combo{color:#f5d020;font-size:11px;font-weight:bold;text-align:center;height:16px;}
</style></head><body>
<h1>🟦 TETRIS</h1>
<div class="srow">
  <div class="sbox"><label>Счёт</label><span id="sc">0</span></div>
  <div class="sbox"><label>Линии</label><span id="ln">0</span></div>
  <div class="sbox"><label>Ур.</label><span id="lv">1</span></div>
</div>
<div class="game-wrap">
  <div class="side">
    <div>
      <div class="mini-label">Hold</div>
      <canvas id="hold-c" width="68" height="68"></canvas>
    </div>
    <div>
      <div class="mini-label">Next</div>
      <canvas id="next-c" width="68" height="68"></canvas>
    </div>
    <div class="combo" id="combo"></div>
  </div>
  <div style="position:relative">
    <canvas id="c" width="180" height="360"></canvas>
    <div class="ov" id="ov">
      <h2>TETRIS</h2><p>Hold=C · Drop=Space</p>
      <button class="obtn" id="sb">▶ Начать</button>
    </div>
  </div>
</div>
<div class="ctls">
  <button class="cb" id="rr">↺</button>
  <button class="cb" id="ml">←</button>
  <button class="cb" id="mdd" style="min-width:54px">⬇⬇</button>
  <button class="cb" id="mr">→</button>
  <button class="cb" id="md">↓</button>
  <button class="cb" id="hb" style="font-size:12px">Hold</button>
</div>
<script>
const C=document.getElementById('c'),X=C.getContext('2d');
const HC=document.getElementById('hold-c'),HX=HC.getContext('2d');
const NC=document.getElementById('next-c'),NX=NC.getContext('2d');
const W=9,H=18,Z=20;
const COLORS=['#7c6fff','#2dd4bf','#f5d020','#fc8181','#68d391','#f6ad55','#b794f4','#f687b3'];
const SHAPES=[
  [[1,1,1,1]],
  [[1,1],[1,1]],
  [[0,1,0],[1,1,1]],
  [[0,1,1],[1,1,0]],
  [[1,1,0],[0,1,1]],
  [[1,0,0],[1,1,1]],
  [[0,0,1],[1,1,1]],
];
let board,cur,curX,curY,nxt,held,canHold,score,lines,lvl,timer,alive=false,combo=0;
const rndP=()=>({s:SHAPES[Math.floor(Math.random()*SHAPES.length)].map(r=>[...r]),c:COLORS[Math.floor(Math.random()*COLORS.length)]});
function fits(p,x,y){
  for(let r=0;r<p.s.length;r++)for(let c=0;c<p.s[r].length;c++)
    if(p.s[r][c]){const nx=x+c,ny=y+r;if(nx<0||nx>=W||ny>=H)return false;if(ny>=0&&board[ny][nx])return false;}
  return true;
}
function rot(p){return{...p,s:p.s[0].map((_,i)=>p.s.map(r=>r[i]).reverse())};}
function spawn(p){
  cur=p;curX=Math.floor(W/2)-Math.ceil(p.s[0].length/2);curY=0;
  if(!fits(cur,curX,curY)){end();return false;}
  return true;
}
function lock(){
  cur.s.forEach((r,ri)=>r.forEach((v,ci)=>{if(v&&curY+ri>=0)board[curY+ri][curX+ci]=cur.c;}));
  let cl=0;
  for(let r=H-1;r>=0;r--){
    if(board[r].every(v=>v)){board.splice(r,1);board.unshift(Array(W).fill(0));cl++;r++;}
  }
  if(cl){
    combo++;const pts=[0,100,300,500,800][Math.min(cl,4)]*lvl+(combo>1?50*combo*lvl:0);
    score+=pts;lines+=cl;lvl=1+Math.floor(lines/10);
    document.getElementById('sc').textContent=score;
    document.getElementById('ln').textContent=lines;
    document.getElementById('lv').textContent=lvl;
    document.getElementById('combo').textContent=combo>1?`${combo}× COMBO!`:'';
    clearInterval(timer);timer=setInterval(step,Math.max(80,520-lvl*42));
  } else {combo=0;document.getElementById('combo').textContent='';}
  canHold=true;
  spawn(nxt);nxt=rndP();drawMini(NX,nxt);
}
function step(){if(!fits(cur,curX,curY+1))lock();else{curY++;draw();}}
function ghostY(){let g=curY;while(fits(cur,curX,g+1))g++;return g;}
function draw(){
  X.fillStyle='#05060a';X.fillRect(0,0,C.width,C.height);
  // grid
  X.strokeStyle='rgba(255,255,255,0.025)';X.lineWidth=1;
  for(let r=0;r<=H;r++){X.beginPath();X.moveTo(0,r*Z);X.lineTo(W*Z,r*Z);X.stroke();}
  for(let c2=0;c2<=W;c2++){X.beginPath();X.moveTo(c2*Z,0);X.lineTo(c2*Z,H*Z);X.stroke();}
  // board
  board.forEach((row,r)=>row.forEach((v,c2)=>{if(v)cell(X,c2,r,v,Z);}));
  // ghost
  const gy=ghostY();
  cur.s.forEach((r,ri)=>r.forEach((v,ci)=>{
    if(v&&gy+ri>=0){X.fillStyle='rgba(255,255,255,0.09)';X.fillRect((curX+ci)*Z+1,(gy+ri)*Z+1,Z-2,Z-2);}
  }));
  // current
  cur.s.forEach((r,ri)=>r.forEach((v,ci)=>{if(v&&curY+ri>=0)cell(X,curX+ci,curY+ri,cur.c,Z);}));
}
function cell(ctx,c2,r,col,z){
  ctx.fillStyle=col;ctx.shadowColor=col;ctx.shadowBlur=7;
  ctx.fillRect(c2*z+1,r*z+1,z-2,z-2);ctx.shadowBlur=0;
  ctx.fillStyle='rgba(255,255,255,0.2)';ctx.fillRect(c2*z+1,r*z+1,z-2,4);
  ctx.fillStyle='rgba(0,0,0,0.2)';ctx.fillRect(c2*z+1,r*z+z-5,z-2,4);
}
function drawMini(ctx,p){
  ctx.fillStyle='#05060a';ctx.fillRect(0,0,68,68);
  if(!p)return;
  const sz=14,ox=(68-p.s[0].length*sz)/2,oy=(68-p.s.length*sz)/2;
  p.s.forEach((row,r)=>row.forEach((v,c2)=>{
    if(v){ctx.fillStyle=p.c;ctx.shadowColor=p.c;ctx.shadowBlur=8;
      ctx.fillRect(ox+c2*sz+1,oy+r*sz+1,sz-2,sz-2);ctx.shadowBlur=0;}
  }));
}
function hold(){
  if(!canHold)return;
  canHold=false;
  if(held){const tmp=held;held={...cur,s:cur.s.map(r=>[...r])};spawn(tmp);}
  else{held={...cur,s:cur.s.map(r=>[...r])};spawn(nxt);nxt=rndP();drawMini(NX,nxt);}
  drawMini(HX,held);
}
function end(){
  clearInterval(timer);alive=false;
  const ov=document.getElementById('ov');
  ov.innerHTML='<h2>GAME OVER</h2><p>Счёт: '+score+'</p><button class="obtn" onclick="startGame()">Заново</button>';
  ov.style.display='flex';
}
function startGame(){
  board=Array.from({length:H},()=>Array(W).fill(0));
  score=0;lines=0;lvl=1;combo=0;held=null;canHold=true;alive=true;
  ['sc','ln','lv'].forEach(id=>document.getElementById(id).textContent=id==='lv'?1:0);
  document.getElementById('combo').textContent='';
  document.getElementById('ov').style.display='none';
  nxt=rndP();spawn(rndP());drawMini(NX,nxt);drawMini(HX,null);
  clearInterval(timer);timer=setInterval(step,520);
}
document.getElementById('sb').onclick=startGame;
document.addEventListener('keydown',e=>{
  if(!alive)return;
  if(e.key==='ArrowLeft'&&fits(cur,curX-1,curY)){curX--;draw();}
  if(e.key==='ArrowRight'&&fits(cur,curX+1,curY)){curX++;draw();}
  if(e.key==='ArrowDown'&&fits(cur,curX,curY+1)){curY++;draw();}
  if(e.key==='ArrowUp'){const r=rot(cur);if(fits(r,curX,curY)){cur=r;draw();}}
  if(e.key===' '){while(fits(cur,curX,curY+1))curY++;lock();draw();}
  if(e.key==='c'||e.key==='C')hold();
  e.preventDefault();
});
document.getElementById('ml').onclick=()=>{if(fits(cur,curX-1,curY)){curX--;draw();}};
document.getElementById('mr').onclick=()=>{if(fits(cur,curX+1,curY)){curX++;draw();}};
document.getElementById('md').onclick=()=>{if(fits(cur,curX,curY+1)){curY++;draw();}};
document.getElementById('rr').onclick=()=>{const r=rot(cur);if(fits(r,curX,curY)){cur=r;draw();}};
document.getElementById('mdd').onclick=()=>{while(fits(cur,curX,curY+1))curY++;lock();draw();};
document.getElementById('hb').onclick=hold;
let tx,ty;
C.addEventListener('touchstart',e=>{tx=e.touches[0].clientX;ty=e.touches[0].clientY;e.preventDefault();},{passive:false});
C.addEventListener('touchend',e=>{
  if(!alive)return;
  const dx=e.changedTouches[0].clientX-tx,dy=e.changedTouches[0].clientY-ty;
  if(Math.abs(dx)>Math.abs(dy)){
    if(Math.abs(dx)>14){if(dx>0&&fits(cur,curX+1,curY))curX++;else if(dx<0&&fits(cur,curX-1,curY))curX--;draw();}
  } else {
    if(dy>22){if(fits(cur,curX,curY+1)){curY++;draw();}}
    else if(dy<-22){while(fits(cur,curX,curY+1))curY++;lock();draw();}
    else if(Math.abs(dy)<14){const r=rot(cur);if(fits(r,curX,curY)){cur=r;draw();}}
  }
},{passive:true});
<\/script></body></html>`);
}

// ══════════════════════════════════════════
// 🔢 2048 — CSS transition-based smooth tiles
// ══════════════════════════════════════════
function create2048() {
  return blobUrl(`<!DOCTYPE html><html><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<title>2048</title><style>
*{margin:0;padding:0;box-sizing:border-box;-webkit-tap-highlight-color:transparent;user-select:none;}
body{background:#05060a;display:flex;flex-direction:column;align-items:center;
  justify-content:center;min-height:100dvh;font-family:'Courier New',monospace;
  color:#e8eaf0;touch-action:none;}
h1{color:#7c6fff;font-size:18px;margin-bottom:6px;letter-spacing:3px;}
.srow{display:flex;gap:12px;margin-bottom:10px;}
.sbox{background:rgba(124,111,255,.12);border:1px solid rgba(124,111,255,.25);
  border-radius:8px;padding:5px 13px;text-align:center;}
.sbox label{display:block;font-size:9px;color:#8892b0;letter-spacing:2px;text-transform:uppercase;}
.sbox span{color:#2dd4bf;font-size:15px;font-weight:bold;}
#board{
  display:grid;grid-template-columns:repeat(4,1fr);gap:7px;padding:9px;
  background:rgba(255,255,255,0.04);border:1px solid rgba(124,111,255,.18);
  border-radius:12px;width:272px;height:272px;position:relative;
}
.cell{
  border-radius:7px;display:flex;align-items:center;justify-content:center;
  font-weight:bold;font-family:'Courier New',monospace;
  transition:transform 0.1s ease, background-color 0.1s ease;
  will-change:transform;
}
/* Tile colours */
.v0   {background:rgba(255,255,255,.03);color:transparent;}
.v2   {background:#7c6fff;color:#fff;font-size:20px;box-shadow:0 0 10px rgba(124,111,255,.35);}
.v4   {background:#6a5ee0;color:#fff;font-size:20px;}
.v8   {background:#2dd4bf;color:#05060a;font-size:20px;box-shadow:0 0 10px rgba(45,212,191,.35);}
.v16  {background:#1ab5a0;color:#fff;font-size:18px;}
.v32  {background:#f5d020;color:#05060a;font-size:18px;box-shadow:0 0 12px rgba(245,208,32,.4);}
.v64  {background:#e0a800;color:#fff;font-size:18px;}
.v128 {background:#fc8181;color:#fff;font-size:16px;box-shadow:0 0 14px rgba(252,129,129,.45);}
.v256 {background:#e55a5a;color:#fff;font-size:14px;}
.v512 {background:#b794f4;color:#fff;font-size:13px;box-shadow:0 0 14px rgba(183,148,244,.45);}
.v1024{background:#9f7aea;color:#fff;font-size:11px;}
.v2048{background:linear-gradient(135deg,#f5d020,#7c6fff);color:#fff;font-size:10px;
  box-shadow:0 0 24px rgba(245,208,32,.7);}
.cell.pop{animation:pop .12s ease;}
@keyframes pop{0%{transform:scale(1);}50%{transform:scale(1.18);}100%{transform:scale(1);}}
#msg{margin:10px 0;font-size:15px;color:#f5d020;height:20px;text-align:center;}
.obtn{background:rgba(124,111,255,.25);border:1px solid #7c6fff;border-radius:8px;
  padding:9px 26px;color:#e8eaf0;font-size:14px;cursor:pointer;font-family:inherit;}
.obtn:active{background:rgba(124,111,255,.5);}
</style></head><body>
<h1>🔢 2048</h1>
<div class="srow">
  <div class="sbox"><label>Счёт</label><span id="sc">0</span></div>
  <div class="sbox"><label>Лучший</label><span id="bs">0</span></div>
</div>
<div id="board"></div>
<div id="msg"></div>
<button class="obtn" id="nb">Новая игра</button>
<script>
let grid,score,best=0,mergedThisTurn;
function init(){
  grid=Array.from({length:4},()=>Array(4).fill(0));
  score=0;document.getElementById('sc').textContent=0;
  document.getElementById('msg').textContent='';
  add();add();render(null);
}
function add(){
  const empty=[];
  grid.forEach((r,ri)=>r.forEach((v,ci)=>{if(!v)empty.push([ri,ci]);}));
  if(!empty.length)return;
  const[r,c]=empty[Math.floor(Math.random()*empty.length)];
  grid[r][c]=Math.random()<0.88?2:4;
  return [r,c];
}
function render(newCell){
  const bd=document.getElementById('board');bd.innerHTML='';
  grid.forEach((row,ri)=>row.forEach((v,ci)=>{
    const d=document.createElement('div');
    d.className='cell v'+Math.min(v,2048);
    d.textContent=v||'';
    if(newCell&&newCell[0]===ri&&newCell[1]===ci)d.classList.add('pop');
    bd.appendChild(d);
  }));
}
function shift(row){
  let r=row.filter(v=>v);
  for(let i=0;i<r.length-1;i++){
    if(r[i]===r[i+1]){r[i]*=2;score+=r[i];if(score>best){best=score;document.getElementById('bs').textContent=best;}r[i+1]=0;mergedThisTurn=true;i++;}
  }
  r=r.filter(v=>v);
  while(r.length<4)r.push(0);
  return r;
}
function move(d){
  mergedThisTurn=false;
  const prev=grid.map(r=>[...r]);
  if(d==='l')grid=grid.map(r=>shift(r));
  if(d==='r')grid=grid.map(r=>shift([...r].reverse()).reverse());
  if(d==='u'){for(let c=0;c<4;c++){const col=grid.map(r=>r[c]);shift(col).forEach((v,r)=>grid[r][c]=v);}}
  if(d==='d'){for(let c=0;c<4;c++){const col=grid.map(r=>r[c]).reverse();shift(col).reverse().forEach((v,r)=>grid[r][c]=v);}}
  const changed=grid.some((r,ri)=>r.some((v,ci)=>v!==prev[ri][ci]));
  if(changed){
    document.getElementById('sc').textContent=score;
    const nc=add();render(nc);check();
  }
}
function check(){
  if(grid.some(r=>r.some(v=>v===2048))){document.getElementById('msg').textContent='🏆 ПОБЕДА!';return;}
  for(let r=0;r<4;r++)for(let c=0;c<4;c++){
    if(!grid[r][c])return;
    if(c<3&&grid[r][c]===grid[r][c+1])return;
    if(r<3&&grid[r][c]===grid[r+1][c])return;
  }
  document.getElementById('msg').textContent='💀 Нет ходов! Счёт: '+score;
}
document.addEventListener('keydown',e=>{
  const m={ArrowLeft:'l',ArrowRight:'r',ArrowUp:'u',ArrowDown:'d'};
  if(m[e.key]){move(m[e.key]);e.preventDefault();}
});
let tx,ty;
document.addEventListener('touchstart',e=>{tx=e.touches[0].clientX;ty=e.touches[0].clientY;},{passive:true});
document.addEventListener('touchend',e=>{
  const dx=e.changedTouches[0].clientX-tx,dy=e.changedTouches[0].clientY-ty;
  if(Math.max(Math.abs(dx),Math.abs(dy))<20)return;
  if(Math.abs(dx)>Math.abs(dy))move(dx>0?'r':'l');
  else move(dy>0?'d':'u');
},{passive:true});
document.getElementById('nb').onclick=init;
init();
<\/script></body></html>`);
}

// ══════════════════════════════════════════
// 🏓 PONG — 60fps rAF, smooth paddle, AI scaling
// ══════════════════════════════════════════
function createPong() {
  return blobUrl(`<!DOCTYPE html><html><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<title>Pong</title><style>
*{margin:0;padding:0;box-sizing:border-box;-webkit-tap-highlight-color:transparent;user-select:none;}
body{background:#05060a;display:flex;flex-direction:column;align-items:center;
  justify-content:center;min-height:100dvh;font-family:'Courier New',monospace;
  color:#e8eaf0;overflow:hidden;}
h1{color:#7c6fff;font-size:18px;margin-bottom:6px;letter-spacing:3px;}
.srow{display:flex;gap:12px;margin-bottom:8px;}
.sbox{background:rgba(124,111,255,.12);border:1px solid rgba(124,111,255,.25);
  border-radius:8px;padding:5px 13px;text-align:center;}
.sbox label{display:block;font-size:9px;color:#8892b0;letter-spacing:2px;text-transform:uppercase;}
.sbox span{color:#2dd4bf;font-size:15px;font-weight:bold;}
#info{font-size:11px;color:#8892b0;margin-bottom:8px;text-align:center;}
.wrap{position:relative;}
canvas{border:1px solid rgba(124,111,255,.28);border-radius:10px;display:block;touch-action:none;}
.ov{position:absolute;inset:0;background:rgba(5,6,10,.88);display:flex;flex-direction:column;
  align-items:center;justify-content:center;border-radius:10px;gap:10px;z-index:10;}
.ov h2{color:#f5d020;font-size:19px;letter-spacing:2px;}
.ov p{color:#8892b0;font-size:13px;}
.obtn{background:rgba(124,111,255,.25);border:1px solid #7c6fff;border-radius:8px;
  padding:10px 28px;color:#e8eaf0;font-size:14px;cursor:pointer;font-family:inherit;}
.obtn:active{background:rgba(124,111,255,.5);}
.ctls{display:none;margin-top:10px;gap:8px;}
@media(pointer:coarse){.ctls{display:flex;}}
.cb{background:rgba(124,111,255,.18);border:1px solid rgba(124,111,255,.3);border-radius:8px;
  padding:10px 24px;color:#e8eaf0;font-size:22px;cursor:pointer;}
.cb:active{background:rgba(124,111,255,.5);}
</style></head><body>
<h1>🏓 PONG</h1>
<div class="srow">
  <div class="sbox"><label>Ты</label><span id="ps">0</span></div>
  <div class="sbox" style="background:rgba(252,129,129,.1);border-color:rgba(252,129,129,.25)">
    <label>AI</label><span id="as" style="color:#fc8181">0</span>
  </div>
</div>
<div id="info">↑↓ / тащи · Первый до 7</div>
<div class="wrap">
  <canvas id="c" width="304" height="224"></canvas>
  <div class="ov" id="ov">
    <h2>PONG</h2><p>Mystery Chat Edition</p>
    <button class="obtn" id="sb">▶ Начать</button>
  </div>
</div>
<div class="ctls">
  <button class="cb" id="cu">↑</button>
  <button class="cb" id="cd">↓</button>
</div>
<script>
const C=document.getElementById('c'),X=C.getContext('2d');
const W=304,H=224,PH=46,PW=10,BR=5.5;
let py,ay,bx,by,bdx,bdy,ps,as,raf,alive=false;
let keys={};
let drag=false,dragY0=0,paddleY0=0;
let lastTime=0;

function resetBall(){
  bx=W/2;by=H/2;
  const spd=3.2+Math.min(ps+as,10)*0.22;
  const ang=(Math.random()*0.5+0.2)*(Math.random()>.5?1:-1);
  bdx=(Math.random()>.5?1:-1)*spd*Math.cos(ang);
  bdy=spd*Math.sin(ang);
}
function startGame(){
  py=H/2-PH/2;ay=H/2-PH/2;ps=0;as=0;alive=true;
  document.getElementById('ps').textContent=0;
  document.getElementById('as').textContent=0;
  document.getElementById('ov').style.display='none';
  resetBall();
  if(raf)cancelAnimationFrame(raf);
  lastTime=performance.now();
  raf=requestAnimationFrame(loop);
}
function loop(now){
  const dt=Math.min((now-lastTime)/16.667,3); // cap delta
  lastTime=now;
  update(dt);
  draw();
  if(alive)raf=requestAnimationFrame(loop);
}
function update(dt){
  // Player input
  const spd=5*dt;
  if(keys.up)   py=Math.max(0,py-spd);
  if(keys.down) py=Math.min(H-PH,py+spd);

  // Ball movement
  bx+=bdx*dt; by+=bdy*dt;

  // Wall bounce
  if(by<=BR){by=BR;bdy=Math.abs(bdy);}
  if(by>=H-BR){by=H-BR;bdy=-Math.abs(bdy);}

  // Player paddle hit
  if(bdx<0&&bx-BR<=PW+7&&bx-BR>=PW+2&&by>=py&&by<=py+PH){
    const rel=(by-(py+PH/2))/(PH/2);
    const spd2=Math.sqrt(bdx*bdx+bdy*bdy)*1.032;
    const ang=rel*0.9;
    bdx=Math.abs(spd2*Math.cos(ang));
    bdy=spd2*Math.sin(ang);
    bx=PW+7+BR;
  }

  // AI paddle hit
  if(bdx>0&&bx+BR>=W-PW-7&&bx+BR<=W-PW-2&&by>=ay&&by<=ay+PH){
    const rel=(by-(ay+PH/2))/(PH/2);
    const spd2=Math.sqrt(bdx*bdx+bdy*bdy)*1.012;
    const ang=rel*0.7;
    bdx=-Math.abs(spd2*Math.cos(ang));
    bdy=spd2*Math.sin(ang);
    bx=W-PW-7-BR;
  }

  // AI movement — predict & track with imperfection
  const aiTarget=by+(bdx>0?(W-PW-7-bx)/Math.max(bdx,.1)*bdy:0);
  const aiCenter=ay+PH/2;
  const aiSpd=(3.0+Math.min(ps+as,10)*0.22)*dt;
  const err=(Math.random()-.5)*6; // small AI error
  if(aiCenter<aiTarget+err-4)ay=Math.min(ay+aiSpd,H-PH);
  else if(aiCenter>aiTarget+err+4)ay=Math.max(ay-aiSpd,0);

  // Score
  if(bx<0){as++;document.getElementById('as').textContent=as;if(as>=7){end('AI победил 😢');return;}resetBall();}
  if(bx>W){ps++;document.getElementById('ps').textContent=ps;if(ps>=7){end('Ты победил! 🏆');return;}resetBall();}
}
function draw(){
  X.fillStyle='#05060a';X.fillRect(0,0,W,H);
  // Center line
  X.setLineDash([5,5]);X.strokeStyle='rgba(255,255,255,0.05)';X.lineWidth=1;
  X.beginPath();X.moveTo(W/2,0);X.lineTo(W/2,H);X.stroke();X.setLineDash([]);
  // Player paddle
  const pg=X.createLinearGradient(5,py,5,py+PH);
  pg.addColorStop(0,'#7c6fff');pg.addColorStop(1,'#2dd4bf');
  X.fillStyle=pg;X.shadowColor='#7c6fff';X.shadowBlur=16;
  X.beginPath();X.roundRect(6,py,PW,PH,5);X.fill();
  // AI paddle
  const ag=X.createLinearGradient(W-14,ay,W-14,ay+PH);
  ag.addColorStop(0,'#fc8181');ag.addColorStop(1,'#f5d020');
  X.fillStyle=ag;X.shadowColor='#fc8181';
  X.beginPath();X.roundRect(W-PW-6,ay,PW,PH,5);X.fill();
  X.shadowBlur=0;
  // Ball trail effect
  X.fillStyle='rgba(255,255,255,0.12)';
  X.beginPath();X.arc(bx-bdx*1.2,by-bdy*1.2,BR*.7,0,Math.PI*2);X.fill();
  // Ball
  X.fillStyle='#fff';X.shadowColor='#fff';X.shadowBlur=18;
  X.beginPath();X.arc(bx,by,BR,0,Math.PI*2);X.fill();
  X.shadowBlur=0;
}
function end(msg){
  alive=false;cancelAnimationFrame(raf);
  const ov=document.getElementById('ov');
  ov.innerHTML='<h2 style="font-size:17px">'+msg+'</h2><p>'+ps+' : '+as+'</p><button class="obtn" onclick="startGame()">Заново</button>';
  ov.style.display='flex';
}
document.getElementById('sb').onclick=startGame;
document.addEventListener('keydown',e=>{
  if(e.key==='ArrowUp')keys.up=true;
  if(e.key==='ArrowDown')keys.down=true;
  if(e.key==='w'||e.key==='W')keys.up=true;
  if(e.key==='s'||e.key==='S')keys.down=true;
  if(!alive&&(e.key==='Enter'||e.key===' '))startGame();
  e.preventDefault();
});
document.addEventListener('keyup',e=>{
  if(e.key==='ArrowUp')keys.up=false;
  if(e.key==='ArrowDown')keys.down=false;
  if(e.key==='w'||e.key==='W')keys.up=false;
  if(e.key==='s'||e.key==='S')keys.down=false;
});
// Button hold
const cu=document.getElementById('cu'),cd=document.getElementById('cd');
cu.addEventListener('pointerdown',()=>keys.up=true);
cu.addEventListener('pointerup',()=>keys.up=false);
cu.addEventListener('pointerleave',()=>keys.up=false);
cd.addEventListener('pointerdown',()=>keys.down=true);
cd.addEventListener('pointerup',()=>keys.down=false);
cd.addEventListener('pointerleave',()=>keys.down=false);
// Touch drag on canvas
C.addEventListener('touchstart',e=>{
  if(!alive){startGame();return;}
  drag=true;dragY0=e.touches[0].clientY;paddleY0=py;
  e.preventDefault();
},{passive:false});
C.addEventListener('touchmove',e=>{
  if(!drag)return;
  py=Math.max(0,Math.min(H-PH,paddleY0+(e.touches[0].clientY-dragY0)));
  e.preventDefault();
},{passive:false});
C.addEventListener('touchend',()=>{drag=false;});
<\/script></body></html>`);
}

// ── Public API ──
export function getGameUrl(id) {
  switch (id) {
    case "snake":  return createSnake();
    case "tetris": return createTetris();
    case "2048":   return create2048();
    case "pong":   return createPong();
    default:       return null;
  }
}
