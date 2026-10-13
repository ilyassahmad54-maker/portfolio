'use client';
import React, { createContext, useContext, useEffect, useState, useSyncExternalStore, useCallback } from 'react';
import type { PortfolioData } from '@/types/portfolio';
import type { PublicContent } from '@/lib/cms/public-content';
import { PortfolioEditor } from '@/lib/cms/editor';
import { imageSource } from '@/lib/cms/legacy';

export function downloadJSON(text:string,name:string){
  const url=URL.createObjectURL(new Blob([text],{type:'application/json'}));
  const link=document.createElement('a');link.href=url;link.download=name;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
interface PortfolioContextType {
  data:PortfolioData; editorData:PortfolioData; model:PortfolioEditor; cms:ReturnType<PortfolioEditor['snapshot']>;
  isCustomized:boolean; isUnlocked:boolean; isLockOpen:boolean; isEditOpen:boolean; toastMessage:string|null;
  setIsLockOpen:(open:boolean)=>void; setIsEditOpen:(open:boolean)=>void; openEditMode:()=>Promise<void>;
  unlockWithPasscode:(passcode:string)=>Promise<boolean>; lockSession:()=>Promise<void>;
  saveData:(data:PortfolioData)=>void; resetToDefault:()=>Promise<boolean>; exportData:()=>void; importData:(raw:string)=>boolean;
  showToast:(message:string)=>void; imageUrl:(reference:string,editor?:boolean)=>string;
}
const PortfolioContext=createContext<PortfolioContextType|undefined>(undefined);
export function PortfolioProvider({children,initialPublished}:{children:React.ReactNode;initialPublished:PublicContent}){
  const [model]=useState(()=>new PortfolioEditor(initialPublished));
  const cms=useSyncExternalStore(model.subscribe,model.snapshot,model.snapshot);
  const [isLockOpen,setIsLockOpen]=useState(false),[isEditOpen,setIsEditOpen]=useState(false),[toastMessage,showToast]=useState<string|null>(null);
  useEffect(()=>{model.acceptPublic(initialPublished);},[initialPublished,model]);
  const detectLegacy=useCallback(()=>{try{model.setLegacy(localStorage.getItem('portfolio_custom_data'));}catch{/* Browser storage may be disabled. */}},[model]);
  useEffect(()=>{void model.checkSession().then(valid=>{if(valid)detectLegacy();});},[model,detectLegacy]);
  useEffect(()=>{
    let pending=false;
    const refresh=async()=>{if(pending||document.visibilityState==='hidden'||model.snapshot().busy)return;pending=true;try{await model.refreshPublic();if(model.snapshot().authenticated)await model.checkSession();}finally{pending=false;}};
    const timer=setInterval(()=>void refresh(),60000);window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',refresh);
    return()=>{clearInterval(timer);window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh);};
  },[model]);
  useEffect(()=>{
    const beforeUnload=(event:BeforeUnloadEvent)=>{if(model.dirty||model.snapshot().busy){event.preventDefault();event.returnValue='';}};
    window.addEventListener('beforeunload',beforeUnload);return()=>window.removeEventListener('beforeunload',beforeUnload);
  },[model]);
  const openEditMode=useCallback(async()=>{
    if(await model.checkSession()){detectLegacy();setIsEditOpen(true);if(!model.snapshot().working)await model.load();}
    else setIsLockOpen(true);
  },[model,detectLegacy]);
  useEffect(()=>{
    const shortcut=(event:KeyboardEvent)=>{if((event.ctrlKey||event.metaKey)&&event.shiftKey&&event.key.toLowerCase()==='e'){event.preventDefault();void openEditMode();}};
    window.addEventListener('keydown',shortcut);return()=>window.removeEventListener('keydown',shortcut);
  },[openEditMode]);
  const unlockWithPasscode=async(passcode:string)=>{
    if(!await model.login(passcode))return false;
    detectLegacy();setIsLockOpen(false);setIsEditOpen(true);if(!model.snapshot().working)await model.load();return true;
  };
  const lockSession=async()=>{
    if((model.dirty||cms.busy)&&!confirm('Log out? Unsaved work stays in memory, but will be lost if you close or reload this page. Export JSON first to back it up.'))return;
    if(await model.logout()){setIsEditOpen(false);setIsLockOpen(false);}else showToast('Logout failed. Try again.');
  };
  const resetToDefault=()=>model.discard(true);
  const exportData=()=>{downloadJSON(JSON.stringify(cms.working||cms.published.content,null,2),'portfolio-draft.json');showToast('JSON backup download requested.');};
  return <PortfolioContext.Provider value={{data:model.display,editorData:cms.working||cms.published.content,model,cms,isCustomized:cms.authenticated&&(model.dirty||!!cms.saved?.state.hasDraft||cms.view!=='published'),isUnlocked:cms.authenticated,isLockOpen,isEditOpen,toastMessage,setIsLockOpen,setIsEditOpen,openEditMode,unlockWithPasscode,lockSession,saveData:model.edit,resetToDefault,exportData,importData:model.compare,showToast,imageUrl:(reference,editor=false)=>imageSource(reference,cms.authenticated&&(editor||cms.view!=='published'))}}>{children}</PortfolioContext.Provider>;
}
export function usePortfolio(){const value=useContext(PortfolioContext);if(!value)throw new Error('PortfolioProvider is required');return value;}
