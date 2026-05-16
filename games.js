// ═══════════════════════════════════════════════════════
// games.js  ·  Mystery Chat v2
// 4 self-contained playable games as blob URL generators
// Snake · Tetris · 2048 · Pong
// ═══════════════════════════════════════════════════════

export const GAMES = [
  { id: 'snake',  title: 'Snake',  icon: '🐍', desc: 'Ешь и не умирай',     creator: 'createSnakeGame'  },
  { id: 'tetris', title: 'Tetris', icon: '🟦', desc: 'Складывай блоки',     creator: 'createTetrisGame' },
  { id: '2048',   title: '2048',   icon: '🔢', desc: 'Складывай числа',     creator: 'create2048Game'   },
  { id: 'pong',   title: 'Pong',   icon: '🏓', desc: 'Классический пинг-понг', creator: 'createPongGame' },
];

// ── SHARED CSS for all games ──
const BASE_CSS = `
*{margin:0;padding:0;box-sizing:border-box;-webkit-tap-highlight-color:transparent;}
body{background:#05060a;display:flex;flex-direction:column;align-items:center;
  justify-content:center;min-height:100vh;font-family:'Courier New',monospace;
  color:#e8eaf0;user-select:none;overflow:hidden;}
h1{color:#7c6fff;font-size:20px;margin-bottom:8px;letter-spacing:3px;text-align:center;}
.score-row{display:flex;gap:16px;margin-bottom:10px;}
.sbox{background:rgba(124,111,255,0.12);border:1px solid rgba(124,111,255,0.25);
  border-radius:8px;padding:6px 14px;text-align:center;}
.sbox label{display:block;font-size:9px;color:#8892b0;letter-spacing:2px;text-transform:uppercase;}
.sbox span{color:#2dd4bf;font-size:16px;font-weight:bold;}
canvas{border:1px solid rgba(124,111,255,0.3);border-radius:10px;display:block;touch-action:none;}
.overlay{position:absolute;inset:0;background:rgba(5,6,10,0.88);display:flex;flex-direction:column;
  align-items:center;justify-content:center;border-radius:10px;gap:10px;z-index:10;}
.overlay h2{color:#f5d020;font-size:20px;letter-spacing:2px;}
.overlay p{color:#8892b0;font-size:13px;}
.obtn{background:rgba(124,111,255,0.25);border:1px solid #7c6fff;border-radius:8px;
  padding:10px 28px;color:#e8eaf0;font-size:14px;cursor:pointer;font-family:inherit;margin-top:4px;}
.obtn:active{background:rgba(124,111,255,0.5);}
.ctrls{display:none;margin-top:12px;gap:8px;}
@media(pointer:coarse){.ctrls{display:flex;flex-wrap:wrap;justify-content:center;}}
.cb{background:rgba(124,111,255,0.18);border:1px solid rgba(124,111,255,0.3);border-radius:8px;
  padding:10px 16px;color:#e8eaf0;font-size:18px;cursor:pointer;min-width:48px;text-align:center;}
.cb:active{background:rgba(124,111,255,0.45);}
`;

// ══════════════════════════════════════════
// SNAKE
// ══════════════════════════════════════════
export function createSnakeGame() {
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Snake</title><style>${BASE_CSS}
#c{cursor:none;}
.hi{color:#f5d020!important;}
</style></head><body>
<h1>🐍 SNAKE</h1>
<div class="score-row">
  <div class="sbox"><label>Счёт</label><span id="sc">0</span></div>
  <div class="sbox"><label>Рекорд</label><span id="hi" class="hi">0</span></div>
</div>
<div style="position:relative">
  <canvas id="c" width="280" height="280"></canvas>
  <div class="overlay" id="ov">
    <h2>SNAKE</h2><p>Mystery Chat Edition</p>
    <button class="obtn" id="sb">Начать</button>
  </div>
</div>
<div class="ctrls">
  <div style="display:grid;grid-template-columns:1fr 1fr 1fr;grid-template-rows:1fr 1fr;gap:6px;">
    <div></div><button class="cb" id="bu">↑</button><div></div>
    <button class="cb" id="bl">←</button>
    <button class="cb" id="bd">↓</button>
    <button class="cb" id="br">→</button>
  </div>
</div>
<script>
const C=document.getElementById('c'),X=C.getContext('2d');
const CELL=14,COLS=20,ROWS=20;
let snake,dir,ndir,food,score,hi=0,timer,running=false;

function rnd(n){return Math.floor(Math.random()*n);}
function placeFood(){
  do{food={x:rnd(COLS),y:rnd(ROWS)};}
  while(snake.some(s=>s.x===food.x&&s.y===food.y));
}
function start(){
  snake=[{x:10,y:10},{x:9,y:10},{x:8,y:10}];
  dir={x:1,y:0};ndir={x:1,y:0};
  score=0;document.getElementById('sc').textContent=0;
  placeFood();
  document.getElementById('ov').style.display='none';
  running=true;
  clearInterval(timer);timer=setInterval(tick,100);
}
function tick(){
  dir={...ndir};
  const head={x:(snake[0].x+dir.x+COLS)%COLS,y:(snake[0].y+dir.y+ROWS)%ROWS};
  if(snake.some(s=>s.x===head.x&&s.y===head.y)){end();return;}
  snake.unshift(head);
  if(head.x===food.x&&head.y===food.y){
    score+=10;document.getElementById('sc').textContent=score;
    if(score>hi){hi=score;document.getElementById('hi').textContent=hi;}
    placeFood();
  } else snake.pop();
  draw();
}
function draw(){
  X.fillStyle='#05060a';X.fillRect(0,0,280,280);
  // Grid dots
  X.fillStyle='rgba(255,255,255,0.03)';
  for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++)
    X.fillRect(c*CELL+CELL/2-1,r*CELL+CELL/2-1,2,2);
  // Food (pulsing)
  const pulse=0.7+0.3*Math.sin(Date.now()*0.006);
  X.shadowColor='#f5d020';X.shadowBlur=12*pulse;
  X.fillStyle='#f5d020';
  X.beginPath();X.arc(food.x*CELL+CELL/2,food.y*CELL+CELL/2,CELL/2-2,0,Math.PI*2);X.fill();
  X.shadowBlur=0;
  // Snake
  snake.forEach((s,i)=>{
    const t=i/snake.length;
    if(i===0){X.shadowColor='#7c6fff';X.shadowBlur=10;}
    X.fillStyle=i===0?'#7c6fff':\`hsl(\${160+t*100},70%,\${50-t*20}%)\`;
    X.beginPath();X.roundRect(s.x*CELL+1,s.y*CELL+1,CELL-2,CELL-2,3);X.fill();
    X.shadowBlur=0;
    if(i===0){// Eyes
      const ex=s.x*CELL+CELL/2+(dir.x*3);
      const ey=s.y*CELL+CELL/2+(dir.y*3);
      X.fillStyle='#fff';
      X.beginPath();X.arc(ex+(dir.y*3),ey+(dir.x*3),2,0,Math.PI*2);X.fill();
      X.beginPath();X.arc(ex-(dir.y*3),ey-(dir.x*3),2,0,Math.PI*2);X.fill();
    }
  });
}
function end(){
  clearInterval(timer);running=false;
  const ov=document.getElementById('ov');
  ov.innerHTML='<h2>GAME OVER</h2><p>Счёт: '+score+'</p><button class="obtn" onclick="start()">Заново</button>';
  ov.style.display='flex';
}
// Keyboard
document.addEventListener('keydown',e=>{
  if(!running&&(e.key==='Enter'||e.key===' ')){start();return;}
  const m={ArrowUp:{x:0,y:-1},ArrowDown:{x:0,y:1},ArrowLeft:{x:-1,y:0},ArrowRight:{x:1,y:0}};
  if(m[e.key]&&!(m[e.key].x===-dir.x&&m[e.key].y===-dir.y))ndir=m[e.key];
  e.preventDefault();
});
document.getElementById('sb').onclick=start;
document.getElementById('bu').onclick=()=>{if(dir.y!==1)ndir={x:0,y:-1};};
document.getElementById('bd').onclick=()=>{if(dir.y!==-1)ndir={x:0,y:1};};
document.getElementById('bl').onclick=()=>{if(dir.x!==1)ndir={x:-1,y:0};};
document.getElementById('br').onclick=()=>{if(dir.x!==-1)ndir={x:1,y:0};};
// Swipe
let ts=null;
C.addEventListener('touchstart',e=>{ts=e.touches[0];e.preventDefault();},{passive:false});
C.addEventListener('touchend',e=>{
  if(!ts)return;
  const dx=e.changedTouches[0].clientX-ts.clientX,dy=e.changedTouches[0].clientY-ts.clientY;
  if(Math.abs(dx)>Math.abs(dy)){if(dx>20&&dir.x!==-1)ndir={x:1,y:0};if(dx<-20&&dir.x!==1)ndir={x:-1,y:0};}
  else{if(dy>20&&dir.y!==-1)ndir={x:0,y:1};if(dy<-20&&dir.y!==1)ndir={x:0,y:-1};}
  ts=null;
},{passive:true});
X.fillStyle='#05060a';X.fillRect(0,0,280,280);
<\/script></body></html>`;
  return blobUrl(html);
}

// ══════════════════════════════════════════
// TETRIS
// ══════════════════════════════════════════
export function createTetrisGame() {
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Tetris</title><style>${BASE_CSS}
.game-wrap{display:flex;gap:12px;align-items:flex-start;}
#next-label{font-size:10px;color:#8892b0;letter-spacing:2px;text-transform:uppercase;margin-bottom:6px;text-align:center;}
#next-c{border:1px solid rgba(124,111,255,0.2);border-radius:6px;}
.side-info{display:flex;flex-direction:column;gap:8px;}
</style></head><body>
<h1>🟦 TETRIS</h1>
<div class="score-row">
  <div class="sbox"><label>Счёт</label><span id="sc">0</span></div>
  <div class="sbox"><label>Уровень</label><span id="lv">1</span></div>
  <div class="sbox"><label>Линии</label><span id="ln">0</span></div>
</div>
<div class="game-wrap">
<div style="position:relative">
  <canvas id="c" width="180" height="360"></canvas>
  <div class="overlay" id="ov">
    <h2>TETRIS</h2><p>Mystery Chat Edition</p>
    <button class="obtn" id="sb">Начать</button>
  </div>
</div>
<div class="side-info">
  <div id="next-label">СЛЕД.</div>
  <canvas id="next-c" width="80" height="80"></canvas>
</div>
</div>
<div class="ctrls">
  <button class="cb" id="rl">↺</button>
  <button class="cb" id="ml">←</button>
  <button class="cb" id="mdd">⬇⬇</button>
  <button class="cb" id="mr">→</button>
  <button class="cb" id="md" style="width:60px">↓</button>
</div>
<script>
const C=document.getElementById('c'),X=C.getContext('2d');
const NC=document.getElementById('next-c'),NX=NC.getContext('2d');
const W=9,H=18,Z=20;
const COLS=['#7c6fff','#2dd4bf','#f5d020','#fc8181','#68d391','#f6ad55','#b794f4'];
const SHAPES=[
  [[1,1,1,1]],[[1,1],[1,1]],
  [[0,1,0],[1,1,1]],[[0,1,1],[1,1,0]],
  [[1,1,0],[0,1,1]],[[1,0,0],[1,1,1]],[[0,0,1],[1,1,1]]
];
let board,cur,curX,curY,next,score,lines,level,timer,running=false,touchX,touchY;

function mkPiece(i){return{s:SHAPES[i].map(r=>[...r]),c:COLS[i],i};}
function rndPiece(){return mkPiece(Math.floor(Math.random()*SHAPES.length));}

function fits(p,x,y){
  for(let r=0;r<p.s.length;r++)for(let c=0;c<p.s[r].length;c++)
    if(p.s[r][c]){
      const nx=x+c,ny=y+r;
      if(nx<0||nx>=W||ny>=H)return false;
      if(ny>=0&&board[ny][nx])return false;
    }
  return true;
}
function rotate(p){return{...p,s:p.s[0].map((_,i)=>p.s.map(r=>r[i]).reverse())};}
function lock(){
  cur.s.forEach((r,ri)=>r.forEach((v,ci)=>{if(v&&curY+ri>=0)board[curY+ri][curX+ci]=cur.c;}));
  clearLines();
  cur=next;next=rndPiece();
  curX=Math.floor(W/2)-Math.floor(cur.s[0].length/2);curY=0;
  if(!fits(cur,curX,curY))endGame();
  drawNext();
}
function clearLines(){
  let cl=0;
  for(let r=H-1;r>=0;r--){
    if(board[r].every(v=>v)){board.splice(r,1);board.unshift(Array(W).fill(0));cl++;r++;}
  }
  if(cl){
    lines+=cl;score+=cl*cl*100*level;level=1+Math.floor(lines/10);
    document.getElementById('sc').textContent=score;
    document.getElementById('lv').textContent=level;
    document.getElementById('ln').textContent=lines;
    clearInterval(timer);timer=setInterval(step,Math.max(80,550-level*45));
  }
}
function step(){if(!fits(cur,curX,curY+1))lock();else{curY++;draw();}}
function draw(){
  X.fillStyle='#05060a';X.fillRect(0,0,C.width,C.height);
  // Grid
  X.strokeStyle='rgba(255,255,255,0.03)';X.lineWidth=1;
  for(let r=0;r<=H;r++){X.beginPath();X.moveTo(0,r*Z);X.lineTo(W*Z,r*Z);X.stroke();}
  for(let c=0;c<=W;c++){X.beginPath();X.moveTo(c*Z,0);X.lineTo(c*Z,H*Z);X.stroke();}
  // Board
  board.forEach((row,r)=>row.forEach((v,c)=>{if(v)drawCell(X,c,r,v,Z);}));
  // Ghost
  let gy=curY;while(fits(cur,curX,gy+1))gy++;
  cur.s.forEach((row,r)=>row.forEach((v,c)=>{
    if(v&&gy+r>=0){X.fillStyle='rgba(255,255,255,0.07)';X.fillRect((curX+c)*Z+1,(gy+r)*Z+1,Z-2,Z-2);}
  }));
  // Current piece
  cur.s.forEach((row,r)=>row.forEach((v,c)=>{if(v&&curY+r>=0)drawCell(X,curX+c,curY+r,cur.c,Z);}));
}
function drawNext(){
  NX.fillStyle='#05060a';NX.fillRect(0,0,80,80);
  const sz=16,ox=(80-next.s[0].length*sz)/2,oy=(80-next.s.length*sz)/2;
  next.s.forEach((row,r)=>row.forEach((v,c)=>{
    if(v){NX.fillStyle=next.c;NX.shadowColor=next.c;NX.shadowBlur=8;
      NX.fillRect(ox+c*sz+1,oy+r*sz+1,sz-2,sz-2);NX.shadowBlur=0;}
  }));
}
function drawCell(ctx,c,r,col,z){
  ctx.fillStyle=col;ctx.shadowColor=col;ctx.shadowBlur=6;
  ctx.fillRect(c*z+1,r*z+1,z-2,z-2);ctx.shadowBlur=0;
  ctx.fillStyle='rgba(255,255,255,0.18)';ctx.fillRect(c*z+1,r*z+1,z-2,4);
  ctx.fillStyle='rgba(0,0,0,0.18)';ctx.fillRect(c*z+1,r*z+z-5,z-2,4);
}
function endGame(){
  clearInterval(timer);running=false;
  const ov=document.getElementById('ov');
  ov.innerHTML='<h2>GAME OVER</h2><p>Счёт: '+score+'</p><button class="obtn" onclick="startGame()">Заново</button>';
  ov.style.display='flex';
}
function startGame(){
  board=Array.from({length:H},()=>Array(W).fill(0));
  score=0;lines=0;level=1;running=true;
  document.getElementById('sc').textContent=0;
  document.getElementById('lv').textContent=1;
  document.getElementById('ln').textContent=0;
  document.getElementById('ov').style.display='none';
  cur=rndPiece();next=rndPiece();
  curX=Math.floor(W/2)-Math.floor(cur.s[0].length/2);curY=0;
  drawNext();clearInterval(timer);timer=setInterval(step,550);
}
document.getElementById('sb').onclick=startGame;
document.addEventListener('keydown',e=>{
  if(!running)return;
  if(e.key==='ArrowLeft'&&fits(cur,curX-1,curY)){curX--;draw();}
  if(e.key==='ArrowRight'&&fits(cur,curX+1,curY)){curX++;draw();}
  if(e.key==='ArrowDown'&&fits(cur,curX,curY+1)){curY++;draw();}
  if(e.key==='ArrowUp'){const r=rotate(cur);if(fits(r,curX,curY)){cur=r;draw();}}
  if(e.key===' '){while(fits(cur,curX,curY+1))curY++;lock();draw();}
  e.preventDefault();
});
document.getElementById('ml').onclick=()=>{if(fits(cur,curX-1,curY)){curX--;draw();}};
document.getElementById('mr').onclick=()=>{if(fits(cur,curX+1,curY)){curX++;draw();}};
document.getElementById('md').onclick=()=>{if(fits(cur,curX,curY+1)){curY++;draw();}};
document.getElementById('rl').onclick=()=>{const r=rotate(cur);if(fits(r,curX,curY)){cur=r;draw();}};
document.getElementById('mdd').onclick=()=>{while(fits(cur,curX,curY+1))curY++;lock();draw();};
C.addEventListener('touchstart',e=>{touchX=e.touches[0].clientX;touchY=e.touches[0].clientY;},{passive:true});
C.addEventListener('touchend',e=>{
  if(!running)return;
  const dx=e.changedTouches[0].clientX-touchX,dy=e.changedTouches[0].clientY-touchY;
  if(Math.abs(dx)>Math.abs(dy)){
    if(Math.abs(dx)>15){if(dx>0&&fits(cur,curX+1,curY))curX++;else if(dx<0&&fits(cur,curX-1,curY))curX--;draw();}
  } else {
    if(dy>20&&fits(cur,curX,curY+1)){curY++;draw();}
    else if(dy<-20){while(fits(cur,curX,curY+1))curY++;lock();draw();}
    else if(Math.abs(dy)<12){const r=rotate(cur);if(fits(r,curX,curY)){cur=r;draw();}}
  }
},{passive:true});
<\/script></body></html>`;
  return blobUrl(html);
}

// ══════════════════════════════════════════
// 2048
// ══════════════════════════════════════════
export function create2048Game() {
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>2048</title><style>${BASE_CSS}
#board{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;padding:10px;
  background:rgba(255,255,255,0.04);border:1px solid rgba(124,111,255,0.2);
  border-radius:12px;width:272px;height:272px;}
.cell{border-radius:8px;display:flex;align-items:center;justify-content:center;
  font-weight:bold;transition:all 0.08s;font-family:'Courier New',monospace;}
.v0{background:rgba(255,255,255,0.03);}
.v2{background:#7c6fff;color:#fff;font-size:20px;box-shadow:0 0 12px rgba(124,111,255,0.4);}
.v4{background:#5a4fd4;color:#fff;font-size:20px;}
.v8{background:#2dd4bf;color:#05060a;font-size:20px;box-shadow:0 0 12px rgba(45,212,191,0.4);}
.v16{background:#1a9b8a;color:#fff;font-size:18px;}
.v32{background:#f5d020;color:#05060a;font-size:18px;box-shadow:0 0 12px rgba(245,208,32,0.4);}
.v64{background:#f0a500;color:#fff;font-size:18px;}
.v128{background:#fc8181;color:#fff;font-size:16px;box-shadow:0 0 15px rgba(252,129,129,0.5);}
.v256{background:#f56565;color:#fff;font-size:15px;}
.v512{background:#b794f4;color:#fff;font-size:14px;box-shadow:0 0 15px rgba(183,148,244,0.5);}
.v1024{background:#9f7aea;color:#fff;font-size:12px;}
.v2048{background:linear-gradient(135deg,#f5d020,#7c6fff);color:#fff;font-size:11px;
  box-shadow:0 0 25px rgba(245,208,32,0.7);}
#msg{margin-top:10px;font-size:16px;color:#f5d020;height:22px;text-align:center;}
</style></head><body>
<h1>🔢 2048</h1>
<div class="score-row">
  <div class="sbox"><label>Счёт</label><span id="sc">0</span></div>
  <div class="sbox"><label>Лучший</label><span id="bs">0</span></div>
</div>
<div id="board"></div>
<div id="msg"></div>
<button class="obtn" id="nb" style="margin-top:10px;">Новая игра</button>
<script>
let grid,score,best=0,moved;
function init(){
  grid=Array.from({length:4},()=>Array(4).fill(0));
  score=0;document.getElementById('sc').textContent=0;
  document.getElementById('msg').textContent='';
  add();add();render();
}
function add(){
  const empty=[];
  grid.forEach((r,ri)=>r.forEach((v,ci)=>{if(!v)empty.push([ri,ci]);}));
  if(!empty.length)return;
  const[r,c]=empty[Math.floor(Math.random()*empty.length)];
  grid[r][c]=Math.random()<0.88?2:4;
}
function render(){
  const bd=document.getElementById('board');bd.innerHTML='';
  grid.forEach(row=>row.forEach(v=>{
    const d=document.createElement('div');
    d.className='cell v'+Math.min(v,2048);
    d.textContent=v||'';bd.appendChild(d);
  }));
}
function shift(row){
  let r=row.filter(v=>v);
  for(let i=0;i<r.length-1;i++){
    if(r[i]===r[i+1]){r[i]*=2;score+=r[i];r[i+1]=0;moved=true;i++;}
  }
  r=r.filter(v=>v);
  while(r.length<4)r.push(0);
  if(row.join()!==r.join())moved=true;
  return r;
}
function move(d){
  moved=false;
  if(d==='l')grid=grid.map(r=>shift(r));
  if(d==='r')grid=grid.map(r=>shift(r.slice().reverse()).reverse());
  if(d==='u'){for(let c=0;c<4;c++){const col=grid.map(r=>r[c]);shift(col).forEach((v,r)=>grid[r][c]=v);}}
  if(d==='d'){for(let c=0;c<4;c++){const col=grid.map(r=>r[c]).reverse();shift(col).reverse().forEach((v,r)=>grid[r][c]=v);}}
  if(moved){
    document.getElementById('sc').textContent=score;
    if(score>best){best=score;document.getElementById('bs').textContent=best;}
    add();render();check();
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
  if(Math.abs(dx)>Math.abs(dy)){if(Math.abs(dx)>20)move(dx>0?'r':'l');}
  else{if(Math.abs(dy)>20)move(dy>0?'d':'u');}
},{passive:true});
document.getElementById('nb').onclick=init;
init();
<\/script></body></html>`;
  return blobUrl(html);
}

// ══════════════════════════════════════════
// PONG
// ══════════════════════════════════════════
export function createPongGame() {
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Pong</title><style>${BASE_CSS}
#info{font-size:11px;color:#8892b0;margin-bottom:8px;text-align:center;}
</style></head><body>
<h1>🏓 PONG</h1>
<div class="score-row">
  <div class="sbox"><label>Ты</label><span id="ps">0</span></div>
  <div class="sbox" style="background:rgba(252,129,129,0.12);border-color:rgba(252,129,129,0.25)"><label>AI</label><span id="as" style="color:#fc8181">0</span></div>
</div>
<div id="info">↑↓ клавиши или перетащи · Первый до 7 побеждает</div>
<div style="position:relative">
<canvas id="c" width="300" height="220"></canvas>
<div class="overlay" id="ov" style="display:flex">
  <h2>PONG</h2><p>Mystery Chat Edition</p>
  <button class="obtn" id="sb">Начать</button>
</div>
</div>
<div class="ctrls" style="margin-top:10px">
  <button class="cb" id="cu" style="font-size:22px;width:80px">↑</button>
  <button class="cb" id="cd" style="font-size:22px;width:80px">↓</button>
</div>
<script>
const C=document.getElementById('c'),X=C.getContext('2d');
const W=300,H=220,PH=44,PW=10,BR=5;
let py,ay,bx,by,bdx,bdy,ps,as,frame,running=false,holding={},touchY0,paddleY0,dragging=false;

function reset(){
  bx=W/2;by=H/2;
  const spd=2.8+Math.min(ps+as,8)*0.2;
  bdx=(Math.random()>0.5?1:-1)*spd;
  bdy=(Math.random()*1.5+0.8)*(Math.random()>0.5?1:-1);
}
function start(){
  py=H/2-PH/2;ay=H/2-PH/2;ps=0;as=0;
  document.getElementById('ps').textContent=0;
  document.getElementById('as').textContent=0;
  document.getElementById('ov').style.display='none';
  running=true;reset();
  if(frame)cancelAnimationFrame(frame);
  loop();
}
function loop(){
  frame=requestAnimationFrame(loop);
  // Player input
  if(holding.up)py=Math.max(0,py-4.5);
  if(holding.down)py=Math.min(H-PH,py+4.5);
  // Ball
  bx+=bdx;by+=bdy;
  if(by<=BR){by=BR;bdy=Math.abs(bdy);}
  if(by>=H-BR){by=H-BR;bdy=-Math.abs(bdy);}
  // Player paddle
  if(bx-BR<=PW+6&&by>=py&&by<=py+PH&&bdx<0){
    bdx=Math.abs(bdx)*1.04;
    bdy+=(by-(py+PH/2))*0.1;
    bdy=Math.max(-5,Math.min(5,bdy));
    bx=PW+6+BR;
  }
  // AI paddle
  if(bx+BR>=W-PW-6&&by>=ay&&by<=ay+PH&&bdx>0){
    bdx=-Math.abs(bdx);
    bdy+=(by-(ay+PH/2))*0.1;
    bx=W-PW-6-BR;
  }
  // AI movement
  const aiSpd=2.4+Math.min(ps+as,10)*0.18;
  if(ay+PH/2<by-5)ay=Math.min(ay+aiSpd,H-PH);
  else if(ay+PH/2>by+5)ay=Math.max(ay-aiSpd,0);
  // Score
  if(bx<0){as++;document.getElementById('as').textContent=as;if(as>=7){end('AI победил 😢');return;}reset();}
  if(bx>W){ps++;document.getElementById('ps').textContent=ps;if(ps>=7){end('Ты победил! 🏆');return;}reset();}
  draw();
}
function draw(){
  X.fillStyle='#05060a';X.fillRect(0,0,W,H);
  X.setLineDash([6,6]);X.strokeStyle='rgba(255,255,255,0.06)';X.lineWidth=1;
  X.beginPath();X.moveTo(W/2,0);X.lineTo(W/2,H);X.stroke();X.setLineDash([]);
  // Player paddle
  const pg=X.createLinearGradient(4,py,4,py+PH);
  pg.addColorStop(0,'#7c6fff');pg.addColorStop(1,'#2dd4bf');
  X.fillStyle=pg;X.shadowColor='#7c6fff';X.shadowBlur=14;
  X.beginPath();X.roundRect(6,py,PW,PH,4);X.fill();
  // AI paddle
  const ag=X.createLinearGradient(W-14,ay,W-14,ay+PH);
  ag.addColorStop(0,'#fc8181');ag.addColorStop(1,'#f5d020');
  X.fillStyle=ag;X.shadowColor='#fc8181';
  X.beginPath();X.roundRect(W-PW-6,ay,PW,PH,4);X.fill();
  X.shadowBlur=0;
  // Ball
  X.fillStyle='#fff';X.shadowColor='#fff';X.shadowBlur=16;
  X.beginPath();X.arc(bx,by,BR,0,Math.PI*2);X.fill();
  X.shadowBlur=0;
}
function end(msg){
  running=false;cancelAnimationFrame(frame);
  const ov=document.getElementById('ov');
  ov.innerHTML='<h2 style="font-size:16px">'+msg+'</h2><p>'+ps+' : '+as+'</p><button class="obtn" onclick="start()">Заново</button>';
  ov.style.display='flex';
}
document.getElementById('sb').onclick=start;
document.addEventListener('keydown',e=>{
  if(e.key==='ArrowUp')holding.up=true;
  if(e.key==='ArrowDown')holding.down=true;
  if(!running&&(e.key==='Enter'||e.key===' '))start();
  e.preventDefault();
});
document.addEventListener('keyup',e=>{
  if(e.key==='ArrowUp')holding.up=false;
  if(e.key==='ArrowDown')holding.down=false;
});
document.getElementById('cu').addEventListener('pointerdown',()=>holding.up=true);
document.getElementById('cu').addEventListener('pointerup',()=>holding.up=false);
document.getElementById('cd').addEventListener('pointerdown',()=>holding.down=true);
document.getElementById('cd').addEventListener('pointerup',()=>holding.down=false);
C.addEventListener('touchstart',e=>{
  if(!running){start();return;}
  dragging=true;touchY0=e.touches[0].clientY;paddleY0=py;e.preventDefault();
},{passive:false});
C.addEventListener('touchmove',e=>{
  if(!dragging)return;
  py=Math.max(0,Math.min(H-PH,paddleY0+(e.touches[0].clientY-touchY0)));
  e.preventDefault();
},{passive:false});
C.addEventListener('touchend',()=>{dragging=false;});
<\/script></body></html>`;
  return blobUrl(html);
}

// ── Helper: create a blob URL from an HTML string ──
function blobUrl(html) {
  const blob = new Blob([html], { type: 'text/html' });
  return URL.createObjectURL(blob);
}

// ── Get game blob URL by id ──
export function getGameUrl(id) {
  switch (id) {
    case 'snake':  return createSnakeGame();
    case 'tetris': return createTetrisGame();
    case '2048':   return create2048Game();
    case 'pong':   return createPongGame();
    default:       return null;
  }
}

// ── Stock avatars (Minotar pixel-art skins) ──
export const STOCK_AVATARS = [
  { id: 'herobrine', name: 'Herobrine', url: 'https://minotar.net/helm/MHF_Herobrine/100.png' },
  { id: 'steve',     name: 'Steve',     url: 'https://minotar.net/helm/MHF_Steve/100.png'    },
  { id: 'alex',      name: 'Alex',      url: 'https://minotar.net/helm/MHF_Alex/100.png'     },
  { id: 'blaze',     name: 'Blaze',     url: 'https://minotar.net/helm/MHF_Blaze/100.png'    },
  { id: 'enderman',  name: 'Enderman',  url: 'https://minotar.net/helm/MHF_Enderman/100.png' },
  { id: 'creeper',   name: 'Creeper',   url: 'https://minotar.net/helm/MHF_Creeper/100.png'  },
  { id: 'zombie',    name: 'Zombie',    url: 'https://minotar.net/helm/MHF_Zombie/100.png'   },
  { id: 'spider',    name: 'Spider',    url: 'https://minotar.net/helm/MHF_CaveSpider/100.png'},
  { id: 'notch',     name: 'Notch',     url: 'https://minotar.net/helm/Notch/100.png'        },
  { id: 'smashh',    name: 'Smashh',    url: 'https://minotar.net/helm/Smashh/100.png'       },
];
