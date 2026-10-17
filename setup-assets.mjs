// Copies MediaPipe WASM locally and downloads the hand model once. Inference then runs fully in-browser.
import {cpSync,mkdirSync,existsSync,writeFileSync} from 'node:fs';
try{
  mkdirSync('public/models',{recursive:true});
  cpSync('node_modules/@mediapipe/tasks-vision/wasm','public/wasm',{recursive:true});
  const f='public/models/hand_landmarker.task';
  if(!existsSync(f)){
    const r=await fetch('https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task');
    if(!r.ok) throw new Error('HTTP '+r.status);
    writeFileSync(f,Buffer.from(await r.arrayBuffer()));
  }
  console.log('Assets ready.');
}catch(e){console.warn('Asset setup failed ('+e.message+'). Re-run: npm run setup');}
