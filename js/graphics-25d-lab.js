(()=>{
'use strict';
const $=id=>document.getElementById(id);
const lab=$('graphics25dLab'),canvas=$('graphics25dCanvas'),open=$('open25dLabBtn'),close=$('close25dLabBtn');
if(!lab||!canvas||!open||!close)return;
const ctx=canvas.getContext('2d',{alpha:false});
const ship=new Image(); ship.src='assets/gallina_1.png';
let active=false,raf=0,last=0,dpr=1,w=1,h=1;
let px=.5,py=.70,tx=.5,ty=.70,tilt=0,shotCooldown=0;
let shots=[],particles=[],stars=[];
function qaVisible(){
  const enabled=window.QA_MODE===true||localStorage.getItem('gallina_qa_mode')==='true'||localStorage.getItem('qa_mode')==='true';
  open.style.display=enabled?'block':'none';
}
function resize(){
 const r=lab.getBoundingClientRect();dpr=Math.min(2,devicePixelRatio||1);w=Math.max(1,r.width);h=Math.max(1,r.height);
 canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);
 if(!stars.length)for(let i=0;i<100;i++)stars.push({x:Math.random(),y:Math.random(),z:.2+Math.random()*.8,s:.5+Math.random()*1.8});
}
function perspective(x,y,z=0){
 const horizon=h*.13,depth=Math.max(.12,(y*h-horizon)/(h-horizon));
 const scale=.58+depth*.72+z*.06;
 return {x:w*.5+(x-.5)*w*(.68+depth*.32),y:horizon+depth*(h-horizon),scale,depth};
}
function fire(){
 if(shotCooldown>0)return;shotCooldown=.18;
 shots.push({x:px,y:py-.055,t:0});
 for(let i=0;i<7;i++)particles.push({x:px+(Math.random()-.5)*.025,y:py-.055,vx:(Math.random()-.5)*.025,vy:-.05-Math.random()*.04,life:.35+Math.random()*.2});
}
function pointer(e,shoot=false){
 const r=canvas.getBoundingClientRect();tx=Math.max(.08,Math.min(.92,(e.clientX-r.left)/r.width));ty=Math.max(.25,Math.min(.9,(e.clientY-r.top)/r.height));if(shoot)fire();
}
canvas.addEventListener('pointerdown',e=>{canvas.setPointerCapture?.(e.pointerId);pointer(e,true);});
canvas.addEventListener('pointermove',e=>{if(e.buttons)pointer(e,false);});
function drawBackground(t){
 const g=ctx.createLinearGradient(0,0,0,h);g.addColorStop(0,'#020617');g.addColorStop(.48,'#111044');g.addColorStop(1,'#030712');ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
 const horizon=h*.13;const glow=ctx.createRadialGradient(w*.5,horizon,0,w*.5,horizon,w*.65);glow.addColorStop(0,'rgba(99,102,241,.28)');glow.addColorStop(1,'rgba(2,6,23,0)');ctx.fillStyle=glow;ctx.fillRect(0,0,w,h*.7);
 for(const st of stars){let yy=(st.y+(t*.000008*st.z))%1;const p=perspective(st.x,yy*.92+.08);ctx.globalAlpha=.35+.65*st.z;ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(p.x,p.y,st.s*p.scale,0,Math.PI*2);ctx.fill();}ctx.globalAlpha=1;
 ctx.strokeStyle='rgba(129,140,248,.10)';ctx.lineWidth=1;
 for(let i=1;i<10;i++){const y=horizon+(h-horizon)*(i/10)**1.7;ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();}
 for(let i=-5;i<=5;i++){ctx.beginPath();ctx.moveTo(w*.5,horizon);ctx.lineTo(w*.5+i*w*.22,h);ctx.stroke();}
}
function frame(now){
 if(!active)return;resize();const dt=Math.min(.035,(now-last)/1000||.016);last=now;shotCooldown=Math.max(0,shotCooldown-dt);
 const ox=px;px+=(tx-px)*Math.min(1,dt*5.5);py+=(ty-py)*Math.min(1,dt*5.5);tilt+=(Math.max(-.45,Math.min(.45,(px-ox)*35))-tilt)*Math.min(1,dt*7);
 drawBackground(now);
 shots.forEach(s=>{s.t+=dt;s.y-=dt*.55;});shots=shots.filter(s=>s.y>.08&&s.t<2);
 for(const s of shots){const p=perspective(s.x,s.y,.08);ctx.save();ctx.shadowBlur=14;ctx.shadowColor='#67e8f9';ctx.strokeStyle='#a5f3fc';ctx.lineWidth=3*p.scale;ctx.beginPath();ctx.moveTo(p.x,p.y+18*p.scale);ctx.lineTo(p.x,p.y-14*p.scale);ctx.stroke();ctx.restore();}
 particles.forEach(p=>{p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;});particles=particles.filter(p=>p.life>0);
 for(const q of particles){const p=perspective(q.x,q.y);ctx.globalAlpha=Math.min(1,q.life*3);ctx.fillStyle='#bae6fd';ctx.beginPath();ctx.arc(p.x,p.y,2.5*p.scale,0,Math.PI*2);ctx.fill();}ctx.globalAlpha=1;
 const p=perspective(px,py,.12),sw=94*p.scale,sh=94*p.scale;
 ctx.save();ctx.translate(p.x,p.y);ctx.transform(1,tilt*.18,tilt*.35,1,0,0);
 ctx.globalAlpha=.32;ctx.fillStyle='#020617';ctx.beginPath();ctx.ellipse(7,sh*.36,sw*.38,sh*.13,0,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;
 ctx.shadowBlur=22;ctx.shadowColor='rgba(56,189,248,.55)';
 if(ship.complete&&ship.naturalWidth)ctx.drawImage(ship,-sw/2,-sh/2,sw,sh);else{ctx.fillStyle='#e2e8f0';ctx.beginPath();ctx.moveTo(0,-sh*.45);ctx.lineTo(sw*.35,sh*.35);ctx.lineTo(0,sh*.22);ctx.lineTo(-sw*.35,sh*.35);ctx.closePath();ctx.fill();}
 ctx.restore();
 raf=requestAnimationFrame(frame);
}
function start(){active=true;lab.style.display='flex';$('startScreen')?.style.setProperty('display','none');last=performance.now();resize();raf=requestAnimationFrame(frame);}
function stop(){active=false;cancelAnimationFrame(raf);lab.style.display='none';$('startScreen')?.style.setProperty('display','flex');}
open.addEventListener('click',start);close.addEventListener('click',stop);
window.addEventListener('resize',()=>active&&resize());
qaVisible();setInterval(qaVisible,1500);
})();