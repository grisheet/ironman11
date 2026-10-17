// Time-aware (frame-rate independent) exponential damping.
export const damp=(a:number,b:number,lambda:number,dt:number)=>a+(b-a)*(1-Math.exp(-lambda*dt));
