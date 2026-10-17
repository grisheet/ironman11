import {useEffect,useRef,RefObject} from 'react';
import {FilesetResolver,HandLandmarker} from '@mediapipe/tasks-vision';
import {CFG} from '../lib/config';import {shared,Hand} from '../lib/store';
export function useHandTracking(video:RefObject<HTMLVideoElement>,overlay:RefObject<HTMLCanvasElement>,onCount:(n:number)=>void){
  const lm=useRef<HandLandmarker|null>(null),raf=useRef(0),run=useRef(false);
  const pin=useRef(new Map<string,{p:boolean;since:number}>());
  async function load(){
    if(lm.current)return;
    const fs=await FilesetResolver.forVisionTasks(import.meta.env.BASE_URL+'wasm');
    for(const delegate of ['GPU','CPU'] as const){
      try{lm.current=await HandLandmarker.createFromOptions(fs,{baseOptions:{modelAssetPath:import.meta.env.BASE_URL+'models/hand_landmarker.task',delegate},
        runningMode:'VIDEO',numHands:2,minHandDetectionConfidence:.6,minHandPresenceConfidence:.6,minTrackingConfidence:.5});return;}catch{}
    }
    throw new Error('Hand model failed to load. Run "npm run setup" (needs network once) so /wasm and /models exist, then reload.');
  }
  async function start(){
    await load();run.current=true;let last=-1,count=-1;
    const loop=()=>{
      if(!run.current)return;raf.current=requestAnimationFrame(loop);
      const v=video.current;if(!v||document.hidden||v.readyState<2||v.currentTime===last)return;last=v.currentTime;
      const now=performance.now(),res=lm.current!.detectForVideo(v,now);
      const hands:Hand[]=[],seen=new Set<string>();
      res.landmarks.forEach((l,i)=>{
        const c=res.handednesses[i]?.[0];if(!c||c.score<.6)return;
        let id=c.categoryName;if(seen.has(id))id+=i;seen.add(id);
        const palm=Math.hypot(l[0].x-l[9].x,l[0].y-l[9].y)||1;
        const d=Math.hypot(l[4].x-l[8].x,l[4].y-l[8].y)/palm;   // thumb-index / palm size
        const st=pin.current.get(id)??{p:false,since:0};
        const raw=st.p?d<CFG.pinchExit:d<CFG.pinchEnter;        // hysteresis
        if(raw&&!st.p)st.since=now;st.p=raw;pin.current.set(id,st);
        hands.push({id,x:(1-l[8].x)*2-1,y:-(l[8].y*2-1),pinch:raw&&now-st.since>=CFG.dwellMs,t:now}); // mirror once
      });
      for(const k of [...pin.current.keys()])if(!seen.has(k))pin.current.delete(k);
      shared.hands=hands;
      if(hands.length!==count){count=hands.length;onCount(count);}
      const cv=overlay.current;
      if(cv){const g=cv.getContext('2d')!;g.clearRect(0,0,cv.width,cv.height);
        if(shared.opts.debug){g.fillStyle='#3ff';res.landmarks.forEach(l=>l.forEach(p=>{g.beginPath();g.arc(p.x*cv.width,p.y*cv.height,3,0,7);g.fill();}));}}
    };
    loop();
  }
  function stop(){run.current=false;cancelAnimationFrame(raf.current);shared.hands=[];onCount(0);
    overlay.current?.getContext('2d')?.clearRect(0,0,640,480);}
  useEffect(()=>()=>{stop();lm.current?.close();lm.current=null;},[]);
  return{start,stop};
}
