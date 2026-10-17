import {useEffect,useRef,RefObject} from 'react';
const MSG:Record<string,string>={
  NotAllowedError:'Camera permission denied. Allow camera access in the browser site settings, then press Start again.',
  NotFoundError:'No camera found. Connect a webcam and try again.',
  NotReadableError:'The camera is in use by another app. Close it and try again.'};
export function useWebcam(video:RefObject<HTMLVideoElement>){
  const stream=useRef<MediaStream|null>(null);
  async function start(){
    if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia)
      throw new Error('Webcam access needs HTTPS or http://localhost. Open the app from localhost or an https URL.');
    try{stream.current=await navigator.mediaDevices.getUserMedia({video:{width:640,height:480,facingMode:'user'},audio:false});}
    catch(e:any){throw new Error(MSG[e.name]??'Camera error: '+e.message);}
    video.current!.srcObject=stream.current;await video.current!.play();
  }
  function stop(){
    stream.current?.getTracks().forEach(t=>t.stop());stream.current=null;
    if(video.current)video.current.srcObject=null;
  }
  useEffect(()=>stop,[]);
  return{start,stop};
}
