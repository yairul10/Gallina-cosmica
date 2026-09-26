(()=>{
'use strict';
const $=id=>document.getElementById(id),screen=$('waitingGamesLab'),canvas=$('waitingGamesCanvas'),ctx=canvas?.getContext('2d'),sel=$('waitingGameSelect'),info=$('waitingGameInfo');
if(!screen||!canvas||!ctx)return;
const icons=['🐔','🐮','🐑','🐴','🌽','⭐'];
let active=false,raf=0,last=0,W=360,H=640,dpr=1,mode='match3',score=0,grid=[],selected=null,particles=[],pairOpen=[],pairLock=false,drag=null,strokes=[],drawing=false;
function resize(){const r=screen.getBoundingClientRect(),nd=Math.min(2,devicePixelRatio||1);if(canvas.width===Math.round(r.width*nd)&&canvas.height===Math.round(r.height*nd))return;W=r.width;H=r.height;dpr=nd;canvas.width=Math.round(W*dpr);canvas.height=Math.round(H*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);}
function burst(x,y,ch){for(let i=0;i<12;i++)particles.push({x,y,ch,vx:(Math.random()-.5)*90,vy:(Math.random()-.5)*90,life:.65});}
function reset(){
 score=0;selected=null;particles=[];pairOpen=[];pairLock=false;drag=null;strokes=[];drawing=false;mode=sel.value;
 if(mode==='match3'){grid=Array.from({length:8},()=>Array.from({length:6},()=>icons[Math.floor(Math.random()*4)]));info.textContent='🧩 Arrastra un personaje hacia un vecino para intercambiarlos y formar líneas de 3 o más.';}
 if(mode==='neon'){grid=[];info.textContent='✨ Dibuja o escribe con el dedo. La estela neón permanece unos segundos y se desvanece suavemente.';}
 if(mode==='pairs'){let a=[];for(let i=0;i<18;i++){let ch=icons[i%icons.length];a.push(ch,ch)};a.sort(()=>Math.random()-.5);grid=a.map((ch,i)=>({ch,open:false,done:false,i}));info.textContent='🃏 Encuentra las parejas en la cuadrícula galáctica. Sin límite de tiempo.';}
}
function bg(t){let g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,'#07112c');g.addColorStop(1,'#160b2f');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);ctx.fillStyle='rgba(255,255,255,.45)';for(let i=0;i<45;i++){let x=(i*83)%W,y=((i*137+t*.012*(1+i%3))%(H+40));ctx.fillRect(x,y,1+(i%3===0),1+(i%3===0));}}
function tile(x,y,w,h,ch,hi=false){ctx.fillStyle=hi?'rgba(56,189,248,.32)':'rgba(30,41,59,.82)';ctx.strokeStyle=hi?'#67e8f9':'rgba(167,139,250,.5)';ctx.lineWidth=2;ctx.beginPath();ctx.roundRect(x+2,y+2,w-4,h-4,10);ctx.fill();ctx.stroke();ctx.font=Math.floor(Math.min(w,h)*.53)+'px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#fff';ctx.fillText(ch,x+w/2,y+h/2+1);}
function match3(){
 const cols=6,rows=8,gap=3,size=Math.min((W-20)/cols,(H-135)/rows),ox=(W-size*cols)/2,oy=112;
 for(let r=0;r<rows;r++)for(let c=0;c<cols;c++)tile(ox+c*size,oy+r*size,size,size,grid[r][c],selected&&selected.r===r&&selected.c===c);
 ctx.fillStyle='#fbbf24';ctx.font='bold 14px sans-serif';ctx.fillText('✨ '+score,42,92);
}
function clearMatches(){
 let hit=new Set();
 for(let r=0;r<8;r++)for(let c=0;c<4;c++)if(grid[r][c]===grid[r][c+1]&&grid[r][c]===grid[r][c+2]){hit.add(r+','+c);hit.add(r+','+(c+1));hit.add(r+','+(c+2));}
 for(let c=0;c<6;c++)for(let r=0;r<6;r++)if(grid[r][c]===grid[r+1][c]&&grid[r][c]===grid[r+2][c]){hit.add(r+','+c);hit.add((r+1)+','+c);hit.add((r+2)+','+c);}
 if(!hit.size)return false;score+=hit.size;for(const k of hit){let [r,c]=k.split(',').map(Number);burst((c+.5)*W/6,(r+.5)*(H-135)/8+112,grid[r][c]);grid[r][c]=null;}
 for(let c=0;c<6;c++){let vals=[];for(let r=7;r>=0;r--)if(grid[r][c])vals.push(grid[r][c]);for(let r=7,i=0;r>=0;r--,i++)grid[r][c]=vals[i]||icons[Math.floor(Math.random()*4)];}
 setTimeout(()=>{if(active&&mode==='match3')clearMatches()},180);return true;
}
function neon(t){
 const now=t/1000;
 ctx.fillStyle='rgba(15,23,42,.38)';ctx.fillRect(8,106,W-16,H-120);
 ctx.strokeStyle='rgba(56,189,248,.09)';ctx.lineWidth=1;
 for(let x=18;x<W;x+=24){ctx.beginPath();ctx.moveTo(x,106);ctx.lineTo(x,H-14);ctx.stroke();}
 for(let y=116;y<H;y+=24){ctx.beginPath();ctx.moveTo(8,y);ctx.lineTo(W-8,y);ctx.stroke();}
 strokes=strokes.filter(st=>now-st.born<4.5);
 for(const st of strokes){if(st.pts.length<2)continue;let age=now-st.born,alpha=Math.max(0,1-age/4.5);ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();ctx.moveTo(st.pts[0].x,st.pts[0].y);for(let i=1;i<st.pts.length;i++)ctx.lineTo(st.pts[i].x,st.pts[i].y);ctx.globalAlpha=alpha*.32;ctx.strokeStyle='#22d3ee';ctx.lineWidth=14;ctx.shadowBlur=20;ctx.shadowColor='#22d3ee';ctx.stroke();ctx.globalAlpha=alpha;ctx.strokeStyle='#e0f2fe';ctx.lineWidth=3;ctx.shadowBlur=9;ctx.stroke();ctx.shadowBlur=0;ctx.globalAlpha=1;}
}
function pairs(){
 const cols=6,rows=6,size=Math.min((W-18)/cols,(H-130)/rows),ox=(W-size*cols)/2,oy=108;
 grid.forEach((o,i)=>{let c=i%cols,r=Math.floor(i/cols),x=ox+c*size,y=oy+r*size;if(o.done){ctx.globalAlpha=.16;tile(x,y,size,size,o.ch);ctx.globalAlpha=1;}else if(o.open)tile(x,y,size,size,o.ch,true);else tile(x,y,size,size,'✦');});
 ctx.fillStyle='#fbbf24';ctx.font='bold 14px sans-serif';ctx.fillText('💫 Parejas: '+score,68,92);
}
function draw(t){if(!active)return;resize();let dt=Math.min(.04,(t-last)/1000||0);last=t;bg(t);if(mode==='match3')match3();else if(mode==='neon')neon(t);else pairs();for(let i=particles.length-1;i>=0;i--){let p=particles[i];p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;if(p.life<=0){particles.splice(i,1);continue}ctx.globalAlpha=p.life;ctx.font='18px sans-serif';ctx.fillText(p.ch,p.x,p.y);ctx.globalAlpha=1}raf=requestAnimationFrame(draw);}
function point(e){let r=canvas.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top};}
function match3Cell(p){let size=Math.min((W-20)/6,(H-135)/8),ox=(W-size*6)/2,oy=112,c=Math.floor((p.x-ox)/size),r=Math.floor((p.y-oy)/size);return(r<0||r>7||c<0||c>5)?null:{r,c};}
function swapMatch3(a,b){if(!a||!b||Math.abs(a.r-b.r)+Math.abs(a.c-b.c)!==1)return;let v=grid[b.r][b.c];grid[b.r][b.c]=grid[a.r][a.c];grid[a.r][a.c]=v;if(!clearMatches())setTimeout(()=>{let q=grid[b.r][b.c];grid[b.r][b.c]=grid[a.r][a.c];grid[a.r][a.c]=q},140);}
canvas.addEventListener('pointerdown',e=>{let p=point(e);canvas.setPointerCapture?.(e.pointerId);
 if(mode==='match3'){drag=match3Cell(p);selected=drag;}
 else if(mode==='neon'){drawing=true;strokes.push({born:performance.now()/1000,pts:[p]});}
 else if(mode==='pairs'&&!pairLock){let size=Math.min((W-18)/6,(H-130)/6),ox=(W-size*6)/2,oy=108,c=Math.floor((p.x-ox)/size),r=Math.floor((p.y-oy)/size),i=r*6+c,o=grid[i];if(!o||o.open||o.done)return;o.open=true;pairOpen.push(o);if(pairOpen.length===2){pairLock=true;let [a,b]=pairOpen;if(a.ch===b.ch){setTimeout(()=>{a.done=b.done=true;score++;burst(((a.i%6)+.5)*size+ox,(Math.floor(a.i/6)+.5)*size+oy,a.ch);pairOpen=[];pairLock=false},300)}else setTimeout(()=>{a.open=b.open=false;pairOpen=[];pairLock=false},650);}}
});
canvas.addEventListener('pointermove',e=>{let p=point(e);if(mode==='neon'&&drawing){let st=strokes[strokes.length-1],q=st.pts[st.pts.length-1];if(!q||Math.hypot(p.x-q.x,p.y-q.y)>2)st.pts.push(p);}else if(mode==='match3'&&drag){let to=match3Cell(p);if(to&&Math.abs(to.r-drag.r)+Math.abs(to.c-drag.c)===1){swapMatch3(drag,to);drag=null;selected=null;}}});
function endPointer(e){if(mode==='match3'&&drag){let to=match3Cell(point(e));swapMatch3(drag,to);}drag=null;selected=null;drawing=false;}
canvas.addEventListener('pointerup',endPointer);canvas.addEventListener('pointercancel',()=>{drag=null;selected=null;drawing=false;});
function start(){active=true;screen.style.display='flex';$('startScreen').style.display='none';reset();last=performance.now();raf=requestAnimationFrame(draw);}
function stop(){active=false;cancelAnimationFrame(raf);screen.style.display='none';$('startScreen').style.display='flex';}
$('openWaitingGamesLabBtn')?.addEventListener('click',start);$('closeWaitingGamesLabBtn')?.addEventListener('click',stop);$('resetWaitingGameBtn')?.addEventListener('click',reset);sel?.addEventListener('change',reset);
})();