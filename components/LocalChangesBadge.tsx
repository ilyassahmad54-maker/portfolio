'use client';
import React from 'react';
import { usePortfolio } from './PortfolioContext';
export default function LocalChangesBadge(){
  const {isCustomized,cms,model,openEditMode,isEditOpen}=usePortfolio();
  if(isEditOpen)return null;
  if(!isCustomized&&!cms.published.readOnly&&!cms.expired)return null;
  return <div role="status" className="fixed bottom-6 left-4 right-4 sm:right-auto z-40 p-3 rounded-xl bg-slate-900/95 border border-amber-500/40 shadow-xl text-xs text-amber-200 max-w-xl">
    {cms.expired?'Session expired; editor work is retained in memory.':cms.view!=='published'?'Admin preview — unpublished content':isCustomized?'Unpublished editor draft':cms.published.source==='fallback'?'Showing deployment backup. Live content is temporarily unavailable.':'Showing last-known published content. Updates are temporarily unavailable.'}
    {(isCustomized||cms.expired)&&<button onClick={()=>void openEditMode()} className="ml-3 text-cyan-300 underline">Open Editor</button>}
    {cms.view!=='published'&&<button onClick={model.showPublished} className="ml-3 text-cyan-300 underline">Show Published</button>}
  </div>;
}
