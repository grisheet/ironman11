import * as THREE from 'three';
import {useFrame,useThree} from '@react-three/fiber';
import {useMemo,useRef} from 'react';
import {CFG} from '../lib/config';import {shared} from '../lib/store';import {damp} from '../lib/smoothing';

const vert=`uniform float uTime;varying vec3 vN;varying vec3 vP;varying vec3 vV;
void main(){vN=normalize(normalMatrix*normal);
vec3 p=position+normal*0.05*sin(position.y*4.+uTime*1.5)*sin(position.x*3.+uTime);vP=p;
vec4 mv=modelViewMatrix*vec4(p,1.);vV=-mv.xyz;gl_Position=projectionMatrix*mv;}`;
const frag=`uniform float uTime;uniform float uBoost;varying vec3 vN;varying vec3 vP;varying vec3 vV;
void main(){float f=pow(1.-abs(dot(normalize(vN),normalize(vV))),2.5);
float scan=.5+.5*sin(vP.y*40.-uTime*2.);
vec3 c=mix(vec3(0.,.45,.7),vec3(.6,1.,1.),f);
gl_FragColor=vec4(c*(.4+f*1.2+scan*.25+uBoost*.5),.25+f*.6);}`;

function Core({perf}:{perf:boolean}){
  const u=useMemo(()=>({uTime:{value:0},uBoost:{value:0}}),[]);
  const g=useRef<THREE.Group>(null!);
  useFrame((_,dt)=>{
    if(!shared.opts.reduced)u.uTime.value+=dt;
    u.uBoost.value=damp(u.uBoost.value,(shared.hover?.5:0)+(shared.mode!=='none'?.8:0),8,dt);
    g.current.scale.setScalar(shared.opts.reduced?1:1+.025*Math.sin(u.uTime.value*1.6)); // idle pulse
  });
  return(<group ref={g}>
    <mesh><icosahedronGeometry args={[1,perf?3:5]}/>
      <shaderMaterial vertexShader={vert} fragmentShader={frag} uniforms={u} transparent depthWrite={false} blending={THREE.AdditiveBlending}/></mesh>
    <mesh><icosahedronGeometry args={[1.12,2]}/><meshBasicMaterial color="#55ffff" wireframe transparent opacity={.28} depthWrite={false}/></mesh>
    <mesh><sphereGeometry args={[.5,24,24]}/><meshBasicMaterial color="#aaffff" transparent opacity={.35} blending={THREE.AdditiveBlending} depthWrite={false}/></mesh>
  </group>);
}
function Rings(){
  const refs=useRef<THREE.Mesh[]>([]);
  const cfg=[[1.6,.012,[1.2,0,0],.4],[1.95,.008,[.4,.9,0],-.3],[2.3,.006,[-.8,.3,.5],.2]] as const;
  useFrame((_,dt)=>{if(shared.opts.reduced)return;refs.current.forEach((m,i)=>{m.rotation.z+=dt*cfg[i][3];});});
  return<>{cfg.map(([r,t,rot],i)=>(
    <group key={i} rotation={rot as any}><mesh ref={m=>m&&(refs.current[i]=m)}><torusGeometry args={[r,t,8,128]}/>
    <meshBasicMaterial color={i===2?'#9a7bff':'#33eeff'} transparent opacity={.7} depthWrite={false}/></mesh></group>))}</>;
}
function Particles({perf}:{perf:boolean}){
  const pos=useMemo(()=>{const n=perf?500:1600,a=new Float32Array(n*3);
    for(let i=0;i<n;i++){const r=1.7+Math.random()*1.1,t=Math.random()*6.283,p=Math.acos(2*Math.random()-1);
      a.set([r*Math.sin(p)*Math.cos(t),r*Math.sin(p)*Math.sin(t),r*Math.cos(p)],i*3);}return a;},[perf]);
  const ref=useRef<THREE.Points>(null!);
  useFrame((_,dt)=>{if(!shared.opts.reduced)ref.current.rotation.y+=dt*.05;});
  return<points ref={ref}><bufferGeometry><bufferAttribute attach="attributes-position" args={[pos,3]}/></bufferGeometry>
    <pointsMaterial color="#88ffff" size={.02} transparent opacity={.7} depthWrite={false}/></points>;
}
function Grid(){
  return<group position={[0,-1.9,0]} rotation={[-Math.PI/2,0,0]}>
    {[1,2,3].map(r=><mesh key={r}><ringGeometry args={[r-.006,r,96]}/><meshBasicMaterial color="#22ccdd" transparent opacity={.5-r*.1} side={THREE.DoubleSide}/></mesh>)}
    {Array.from({length:12},(_,i)=><mesh key={i} rotation={[0,0,i*Math.PI/12]}><planeGeometry args={[6,.004]}/><meshBasicMaterial color="#22ccdd" transparent opacity={.18}/></mesh>)}
  </group>;
}

// Gesture controller + cursor. All hand data comes from `shared` refs.
function Rig({perf}:{perf:boolean}){
  const{camera}=useThree();
  const grp=useRef<THREE.Group>(null!),cur=useRef<THREE.Mesh>(null!),mat=useRef<THREE.MeshBasicMaterial>(null!);
  const s=useRef({mode:'none' as 'none'|'drag'|'scale',hid:'',ids:['',''],pos:new THREE.Vector3(),vel:new THREE.Vector3(),
    off:new THREE.Vector3(),tgt:new THREE.Vector3(),scale:1,tScale:1,d0:1,s0:1,lock:false,lastAct:0,lastSeen:0}).current;
  const ray=useMemo(()=>new THREE.Raycaster(),[]);
  const plane=useMemo(()=>new THREE.Plane(new THREE.Vector3(0,0,1),0),[]); // fixed interaction plane z=0
  const toPlane=(x:number,y:number)=>{ray.setFromCamera(new THREE.Vector2(x,y),camera);
    return ray.ray.intersectPlane(plane,new THREE.Vector3())??new THREE.Vector3();};

  useFrame((_,dtRaw)=>{
    const dt=Math.min(dtRaw,.05),now=performance.now(),m=shared.mouse;
    if(shared.reset){s.pos.set(0,0,0);s.vel.set(0,0,0);s.scale=s.tScale=1;s.mode='none';s.lock=true;shared.reset=false;}
    let hs=shared.hands.filter(h=>now-h.t<CFG.staleMs);
    if(!hs.length&&m.on)hs=[{id:'mouse',x:m.x,y:m.y,pinch:m.down,t:now}];
    if(shared.wheel){s.tScale=THREE.MathUtils.clamp(s.tScale*Math.exp(-shared.wheel*.001),CFG.minScale,CFG.maxScale);s.lastAct=now;shared.wheel=0;}
    const pts=hs.map(h=>toPlane(h.x,h.y));
    const R=1.15*s.scale,over=(i:number)=>pts[i].distanceTo(s.pos)<R; // hit test on the plane
    const pin=hs.map((_,i)=>i).filter(i=>hs[i].pinch);
    if(hs.length)s.lastSeen=now;
    if(!pin.length)s.lock=false;
    if(!hs.length&&s.mode!=='none'&&now-s.lastSeen>CFG.graceMs)s.mode='none';  // tracking lost -> release
    const both=pin.length>=2&&over(pin[0])&&over(pin[1]);
    const startScale=()=>{s.mode='scale';s.ids=[hs[pin[0]].id,hs[pin[1]].id];s.d0=Math.max(.05,pts[pin[0]].distanceTo(pts[pin[1]]));s.s0=s.tScale;};
    if(s.mode==='none'&&!s.lock&&hs.length){
      if(both)startScale();
      else if(pin.length===1&&over(pin[0])){s.mode='drag';s.hid=hs[pin[0]].id;s.off.copy(s.pos).sub(pts[pin[0]]);s.vel.set(0,0,0);} // no jump
    }else if(s.mode==='drag'){
      const i=hs.findIndex(h=>h.id===s.hid);
      if(both)startScale();                                     // two-hand overrides drag
      else if(i<0||!hs[i].pinch){s.mode='none';}                // release (momentum continues below)
      else{s.tgt.copy(pts[i]).add(s.off);
        const nx=damp(s.pos.x,s.tgt.x,18,dt),ny=damp(s.pos.y,s.tgt.y,18,dt);
        s.vel.set((nx-s.pos.x)/dt,(ny-s.pos.y)/dt,0).clampLength(0,3);s.pos.set(nx,ny,0);}
    }else if(s.mode==='scale'){
      const a=hs.findIndex(h=>h.id===s.ids[0]),b=hs.findIndex(h=>h.id===s.ids[1]);
      if(a<0||b<0||!hs[a].pinch||!hs[b].pinch){s.mode='none';s.lock=pin.length>0;}   // lock avoids jump to drag
      else s.tScale=THREE.MathUtils.clamp(s.s0*pts[a].distanceTo(pts[b])/s.d0,CFG.minScale,CFG.maxScale);
    }
    if(s.mode!=='none'||pin.length)s.lastAct=now;
    if(s.mode!=='drag'){ // momentum, or idle return to centre
      if(CFG.momentum&&s.vel.lengthSq()>1e-4){s.pos.addScaledVector(s.vel,dt);s.vel.multiplyScalar(Math.exp(-4*dt));}
      if(s.mode==='none'&&now-s.lastAct>CFG.idleMs){s.pos.x=damp(s.pos.x,0,1.5,dt);s.pos.y=damp(s.pos.y,0,1.5,dt);s.tScale=damp(s.tScale,1,1.5,dt);s.vel.set(0,0,0);}
    }
    s.pos.x=THREE.MathUtils.clamp(s.pos.x,-CFG.bounds,CFG.bounds);s.pos.y=THREE.MathUtils.clamp(s.pos.y,-CFG.bounds,CFG.bounds);
    s.scale=damp(s.scale,s.tScale,12,dt);
    grp.current.position.copy(s.pos);grp.current.scale.setScalar(s.scale);
    // cursor + hover feedback
    const hover=hs.length>0&&over(0);shared.hover=hover;shared.mode=s.mode;
    cur.current.visible=hs.length>0;
    if(hs.length){cur.current.position.set(pts[0].x,pts[0].y,.3);
      cur.current.scale.setScalar(hs[0].pinch?.8:hover?1.6:1);
      mat.current.color.set(hs[0].pinch?'#ffffff':hover?'#aaffff':'#22eeff');}
  });
  return<>
    <group ref={grp}><Core perf={perf}/><Rings/><Particles perf={perf}/></group>
    <Grid/>
    <mesh ref={cur} renderOrder={10}><ringGeometry args={[.07,.09,32]}/>
      <meshBasicMaterial ref={mat} color="#22eeff" depthTest={false} transparent/></mesh>
  </>;
}
export function HologramScene({perf}:{perf:boolean}){
  return<><color attach="background" args={['#040a14']}/><fog attach="fog" args={['#040a14',7,14]}/><Rig perf={perf}/></>;
}
