(()=>{
'use strict';
const $=id=>document.getElementById(id),screen=$('waitingGamesLab'),canvas=$('waitingGamesCanvas'),ctx=canvas?.getContext('2d'),sel=$('waitingGameSelect'),info=$('waitingGameInfo');
if(!screen||!canvas||!ctx)return;
const icons=['🐔','🐮','🐑','🐴','🌽','⭐'];
let active=false,raf=0,last=0,W=360,H=640,dpr=1,mode='match3',score=0,grid=[],selected=null,particles=[],fallers=[],pairOpen=[],pairLock=false;
function resize(){const r=screen.getBoundingClientRect(),nd=Math.min(2,devicePixelRatio||1);if(canvas.width===Math.round(r.width*nd)&&canvas.height===Math.round(r.height*nd))return;W=r.width;H=r.height;dpr=nd;canvas.width=Math.round(W*dpr);canvas.height=Math.round(H*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);}
function burst(x,y,ch){for(let i=0;i<12;i++)particles.push({x,y,ch,vx:(Math.random()-.5)*90,vy:(Math.random()-.5)*90,life:.65});}
function reset(){
 score=0;selected=null;particles=[];pairOpen=[];pairLock=false;mode=sel.value;
 if(mode==='match3'){grid=Array.from({length:8},()=>Array.from({length:6},()=>icons[Math.floor(Math.random()*4)]));info.textContent='🧩 Toca dos personajes vecinos para intercambiarlos. Forma líneas de 3 o más iguales.';}
 if(mode==='formations'){grid=[];fallers=[];for(let i=0;i<28;i++)fallers.push({x:.08+Math.random()*.84,y:.18+Math.random()*.7,ch:icons[Math.floor(Math.random()*6)],r:16+Math.random()*8});info.textContent='🌌 Une 3 símbolos iguales tocándolos. Cada trío desaparece con una explosión suave.';}
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
function formations(){
 ctx.fillStyle='#fbbf24';ctx.font='bold 14px sans-serif';ctx.fillText('✨ '+score,42,92);
 for(const o of fallers){ctx.beginPath();ctx.arc(o.x*W,o.y*H,o.r,0,Math.PI*2);ctx.fillStyle='rgba(76,29,149,.55)';ctx.fill();ctx.font=(o.r*1.35)+'px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(o.ch,o.x*W,o.y*H);}
}
function pairs(){
 const cols=6,rows=6,size=Math.min((W-18)/cols,(H-130)/rows),ox=(W-size*cols)/2,oy=108;
 grid.forEach((o,i)=>{let c=i%cols,r=Math.floor(i/cols),x=ox+c*size,y=oy+r*size;if(o.done){ctx.globalAlpha=.16;tile(x,y,size,size,o.ch);ctx.globalAlpha=1;}else if(o.open)tile(x,y,size,size,o.ch,true);else tile(x,y,size,size,'✦');});
 ctx.fillStyle='#fbbf24';ctx.font='bold 14px sans-serif';ctx.fillText('💫 Parejas: '+score,68,92);
}
function draw(t){if(!active)return;resize();let dt=Math.min(.04,(t-last)/1000||0);last=t;bg(t);if(mode==='match3')match3();else if(mode==='formations')formations();else pairs();for(let i=particles.length-1;i>=0;i--){let p=particles[i];p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;if(p.life<=0){particles.splice(i,1);continue}ctx.globalAlpha=p.life;ctx.font='18px sans-serif';ctx.fillText(p.ch,p.x,p.y);ctx.globalAlpha=1}raf=requestAnimationFrame(draw);}
function point(e){let r=canvas.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top};}
canvas.addEventListener('pointerdown',e=>{let p=point(e);
 if(mode==='match3'){let size=Math.min((W-20)/6,(H-135)/8),ox=(W-size*6)/2,oy=112,c=Math.floor((p.x-ox)/size),r=Math.floor((p.y-oy)/size);if(r<0||r>7||c<0||c>5)return;if(!selected){selected={r,c};return}let d=Math.abs(r-selected.r)+Math.abs(c-selected.c);if(d===1){let a=grid[r][c];grid[r][c]=grid[selected.r][selected.c];grid[selected.r][selected.c]=a;if(!clearMatches()){setTimeout(()=>{let b=grid[r][c];grid[r][c]=grid[selected.r][selected.c];grid[selected.r][selected.c]=b},140)}}selected=null;}
 else if(mode==='formations'){let hit=fallers.find(o=>Math.hypot(p.x-o.x*W,p.y-o.y*H)<o.r+10);if(!hit)return;let same=fallers.filter(o=>o.ch===hit.ch).sort((a,b)=>Math.hypot(a.x-hit.x,a.y-hit.y)-Math.hypot(b.x-hit.x,b.y-hit.y)).slice(0,3);if(same.length===3){same.forEach(o=>{burst(o.x*W,o.y*H,o.ch);fallers.splice(fallers.indexOf(o),1)});score+=3;while(fallers.length<28)fallers.push({x:.08+Math.random()*.84,y:.18+Math.random()*.7,ch:icons[Math.floor(Math.random()*6)],r:16+Math.random()*8});}}
 else if(mode==='pairs'&&!pairLock){let size=Math.min((W-18)/6,(H-130)/6),ox=(W-size*6)/2,oy=108,c=Math.floor((p.x-ox)/size),r=Math.floor((p.y-oy)/size),i=r*6+c,o=grid[i];if(!o||o.open||o.done)return;o.open=true;pairOpen.push(o);if(pairOpen.length===2){pairLock=true;let [a,b]=pairOpen;if(a.ch===b.ch){setTimeout(()=>{a.done=b.done=true;score++;burst(((a.i%6)+.5)*size+ox,(Math.floor(a.i/6)+.5)*size+oy,a.ch);pairOpen=[];pairLock=false},300)}else setTimeout(()=>{a.open=b.open=false;pairOpen=[];pairLock=false},650);}}
});
function start(){active=true;screen.style.display='flex';$('startScreen').style.display='none';reset();last=performance.now();raf=requestAnimationFrame(draw);}
function stop(){active=false;cancelAnimationFrame(raf);screen.style.display='none';$('startScreen').style.display='flex';}
$('openWaitingGamesLabBtn')?.addEventListener('click',start);$('closeWaitingGamesLabBtn')?.addEventListener('click',stop);$('resetWaitingGameBtn')?.addEventListener('click',reset);sel?.addEventListener('change',reset);
})();