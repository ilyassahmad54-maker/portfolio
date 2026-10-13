'use client';
import React,{useState} from 'react';
import Image,{type ImageProps} from 'next/image';
export default function PortfolioImage(props:ImageProps){
  const [failed,setFailed]=useState<string|null>(null),key=String(props.src);
  if(failed===key)return <div role="img" aria-label={`${props.alt} — image temporarily unavailable`} className="absolute inset-0 flex items-center justify-center bg-slate-900 text-slate-400 text-xs p-4 text-center">Image temporarily unavailable</div>;
  return <Image {...props} alt={props.alt} onError={()=>setFailed(key)}/>;
}
