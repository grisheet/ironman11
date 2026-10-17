import {useEffect,useRef,useState} from 'react';
import {Canvas} from '@react-three/fiber';
import {HologramScene} from './scene/HologramScene';
import {useWebcam} from './hooks/useWebcam';
import {useHandTracking} from './hooks/useHandTracking';
import {shared} from './lib/store';

const hasGL=(()=>{try{const c=document.createElement('canvas');return!!(c.getContext('webgl2')||c.getContext('webgl'));}catch{return false;}})();

export default function App(){
  const video=useRef<HTMLVideoElement>(null),overlay=useRef<HTMLCanvasElement>(null);
  const[phase,setPhase]=useState<'idle'|'busy'|'run'>('idle');
  const[msg,setMsg]=useState(''),[err,setErr]=useState(''),[hands,setHands]=useState(0);
  const[preview,setPreview]=useState(true),[debug,setDebug]=useState(false),[backdrop,setBackdrop]=useState(false),
    [perf,setPerf]=useState(false),[reduced,setReduced]=useState(matchMedia('(prefers-reduced-motion: reduce)').matches);
  const cam=useWebcam(video),tracker=useHandTracking(video,overlay,setHands);
  useEffect(()=>{shared.opts={reduced,perf,debug};},[reduced,perf,debug]);
  useEffect(()=>{const k=(e:KeyboardEvent)=>{if(e.key==='r'||e.key==='R')shared.reset=true;};
    addEventListener('keydown',k);return()=>removeEventListener('keydown',k);},[]);

  async function start(){
    setErr('');setPhase('busy');
    try{setMsg('Requesting camera…');await cam.start();setMsg('Loading hand-tracking model…');await tracker.start();setPhase('run');}
    catch(e:any){tracker.stop();cam.stop();setErr(e.message);setPhase('idle');}
  }
  function stop(){tracker.stop();cam.stop();setPhase('idle');}
  const mp=(e:React.PointerEvent)=>{const r=e.currentTarget.getBoundingClientRect();
    shared.mouse.x=(e.clientX-r.left)/r.width*2-1;shared.mouse.y=-((e.clientY-r.top)/r.height*2-1);shared.mouse.on=true;};

  return(<div className="app">
    <video ref={video} muted playsInline className={backdrop&&phase==='run'?'bd':preview&&phase==='run'?'pv':'off'}/>
    <div className="stage" onPointerMove={mp} onPointerDown={e=>{mp(e);shared.mouse.down=true;}} onPointerUp={()=>shared.mouse.down=false}
      onPointerLeave={()=>{shared.mouse.on=false;shared.mouse.down=false;}} onWheel={e=>{shared.wheel+=e.deltaY;}}>
      {hasGL?<Canvas dpr={perf?1:[1,2]} camera={{position:[0,0,5],fov:50}} gl={{alpha:true,antialias:!perf}}><HologramScene perf={perf}/></Canvas>
        :<p className="msg">WebGL is unavailable. Enable hardware acceleration or try another browser.</p>}
    </div>
    <canvas ref={overlay} width={640} height={480} className={'ov '+(preview&&!backdrop&&phase==='run'?'':'off')}/>
    <header><b>HOLOGRAPHIC COMMAND INTERFACE</b>
      <span className="st">{phase==='run'?`Camera ready · ${hands} hand${hands===1?'':'s'} detected`:phase==='busy'?msg:'Camera off · mouse fallback active'}</span></header>
    {phase!=='run'&&<div className="center">
      <button className="big" onClick={start} disabled={phase==='busy'}>{phase==='busy'?msg:'Start Experience'}</button>
      <p>Webcam stays on-device. No video is recorded or uploaded. Requires HTTPS or localhost.</p>
      {err&&<p className="err" role="alert">{err}</p>}</div>}
    <aside>
      <button onClick={()=>shared.reset=true}>Reset (R)</button>
      {phase==='run'&&<button onClick={stop}>Stop Camera</button>}
      <label><input type="checkbox" checked={preview} onChange={e=>setPreview(e.target.checked)}/> Camera preview</label>
      <label><input type="checkbox" checked={backdrop} onChange={e=>setBackdrop(e.target.checked)}/> Camera backdrop</label>
      <label><input type="checkbox" checked={debug} onChange={e=>setDebug(e.target.checked)}/> Landmark debug</label>
      <label><input type="checkbox" checked={perf} onChange={e=>setPerf(e.target.checked)}/> Performance mode</label>
      <label><input type="checkbox" checked={reduced} onChange={e=>setReduced(e.target.checked)}/> Reduced motion</label>
      <small>Point: cursor · Pinch over core: grab · Pinch with both hands on core: scale · Mouse: drag + wheel</small>
    </aside></div>);
}
