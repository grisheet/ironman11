// Mutable per-frame data: read in useFrame, never triggers React rerenders.
// x,y are NDC (-1..1), already mirrored (done once, in useHandTracking).
export type Hand={id:string;x:number;y:number;pinch:boolean;t:number};
export const shared={
  hands:[] as Hand[],
  mouse:{on:false,x:0,y:0,down:false},
  wheel:0,reset:false,hover:false,mode:'none' as 'none'|'drag'|'scale',
  opts:{reduced:false,perf:false,debug:false},
};
