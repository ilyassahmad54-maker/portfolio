'use client';
import React, { useState, useEffect } from 'react';
import { usePortfolio,downloadJSON } from './PortfolioContext';
const button='px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold disabled:opacity-40 hover:bg-cyan-500/10';
function concise(value:unknown){if(value===undefined)return '(absent)';const text=JSON.stringify(value);return text.length>260?text.slice(0,260)+'…':text;}
export default function CmsControls(){
  const {cms,model,setIsLockOpen,setIsEditOpen,exportData}=usePortfolio();
  const [selected,setSelected]=useState<string[]>([]);
  useEffect(()=>{setSelected([]);},[cms.importChanges]);
  const act=async(action:()=>Promise<boolean>)=>{await action();};
  return <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 space-y-3 text-xs shrink-0 max-h-[40vh] overflow-y-auto" aria-label="CMS publication controls">
    <p role="status" aria-live="polite">{cms.status}{cms.saved?` · Version ${cms.saved.state.version} · Published ${cms.saved.state.publishedRevisionId.slice(0,8)} · Draft ${cms.saved.revisionId.slice(0,8)}`:''}{model.dirty?' · Unsaved changes':''}</p>
    {cms.error&&<p role="alert" className="text-rose-600 dark:text-rose-400">{cms.error}</p>}
    {cms.conflict&&<p className="text-amber-600">Your work is preserved. Export JSON before loading the newer saved draft; compare the export to import selected changes.</p>}
    {!cms.authenticated&&<button className={button} onClick={()=>setIsLockOpen(true)}>Sign in again — keep editor work</button>}
    <div className="flex flex-wrap gap-2">
      <button className={button} disabled={cms.busy||!cms.authenticated} onClick={()=>{if(!model.dirty||confirm('Replace unsaved editor changes with the current saved draft? Export JSON first to retain them.'))void act(()=>model.load(true));}}>Load Saved Draft</button>
      <button className={button} disabled={cms.busy||!cms.authenticated||!cms.saved} onClick={()=>void act(model.save)}>Save Draft</button>
      <button className={button} disabled={cms.busy||!cms.authenticated||!cms.saved} onClick={()=>void act(async()=>{const ok=await model.previewSaved();if(ok)setIsEditOpen(false);return ok;})}>Preview Draft</button>
      <button className={button} disabled={cms.busy||!cms.working} onClick={()=>{if(model.previewWorking())setIsEditOpen(false);}}>Preview Unsaved Edits</button>
      <button className={button} onClick={model.showPublished}>Show Published</button>
      <button className={button+' text-emerald-600'} disabled={cms.busy||!cms.authenticated||model.dirty||!cms.saved||!cms.saved.state.hasDraft} onClick={()=>{if(confirm('Publish this saved draft for every visitor?'))void act(()=>model.publish(true));}}>Publish Changes</button>
      <button className={button+' text-rose-600'} disabled={cms.busy||!cms.authenticated||!cms.saved} onClick={()=>{if(confirm('Discard the saved draft and unsaved editor changes? Existing browser-local drafts will remain untouched.'))void act(()=>model.discard(true));}}>Discard Changes</button>
      <button className={button} onClick={exportData}>Back Up Editor JSON</button>
      <button className={button} disabled={cms.busy||!cms.authenticated} onClick={()=>void act(()=>model.history())}>Revision History</button>
    </div>
    {cms.legacy&&!cms.legacyHidden&&<div className="p-3 rounded-xl border border-amber-500/40 space-y-2">
      <p>Legacy browser draft detected. It has not been loaded, changed, or published.</p>
      <div className="flex flex-wrap gap-2">
        <button className={button} onClick={()=>downloadJSON(cms.legacy!,'legacy-portfolio-backup.json')}>Export Original Browser Draft</button>
        <button className={button} disabled={cms.busy||!cms.working} onClick={()=>{model.compare(cms.legacy!);setSelected([]);}}>Compare Browser Draft</button>
        <button className={button} onClick={model.dismissLegacy}>Hide Notice This Session</button>
      </div>
    </div>}
    {!!cms.importChanges.length&&<div className="space-y-2 border border-cyan-500/40 rounded-xl p-3">
      <p>Select individual changes. Nothing is selected automatically. Imports stay unpublished.</p>
      {cms.importChanges.map(change=><label key={change.id} className="block border-b border-slate-300 dark:border-slate-700 py-2 break-words">
        <input type="checkbox" checked={selected.includes(change.id)} disabled={cms.busy} onChange={event=>setSelected(event.target.checked?[...selected,change.id]:selected.filter(id=>id!==change.id))}/>{' '}{change.kind==='remove'?'Remove: ':''}{change.label}
        <span className="block ml-5 text-slate-500">Current: {concise(change.before)}</span><span className="block ml-5">Imported: {concise(change.after)}</span>
      </label>)}
      <button className={button} disabled={cms.busy||!selected.length} onClick={()=>void act(()=>model.importSelected(selected))}>Import Selected Changes</button>{' '}
      <button className={button} disabled={cms.busy} onClick={model.clearComparison}>Cancel Comparison</button>
    </div>}
    {cms.history&&<div className="space-y-2"><p>Revision history — newest first</p>
      {cms.history.items.map(item=><div key={item.revisionId} className="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-slate-800 py-1">
        <span>#{item.sequence} · {item.operation==='seed'?'migration':item.operation} · {new Date(item.createdAt).toLocaleString()} · {item.revisionId.slice(0,8)}{item.revisionId===cms.history?.state.publishedRevisionId?' · currently published':''}{item.revisionId===cms.history?.state.draftRevisionId?' · current saved draft':''}</span>
        <button className={button} disabled={cms.busy} onClick={()=>void act(()=>model.viewRevision(item.revisionId))}>View Revision</button>
        {item.operation!=='draft'&&<button className={button} disabled={cms.busy||!cms.authenticated||!cms.saved} onClick={()=>{if(confirm('Restore this published version for every visitor? Independent draft/editor work will be preserved.'))void act(()=>model.restore(item.revisionId,true));}}>Restore Published Version</button>}
      </div>)}
      {cms.history.nextCursor&&<button className={button} disabled={cms.busy} onClick={()=>void act(()=>model.history(true))}>Load More Revisions</button>}
    </div>}
    {cms.selected&&<details><summary>Selected revision #{cms.selected.sequence}: {cms.selected.operation}</summary><pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all">{JSON.stringify(cms.selected.content,null,2)}</pre><button className={button} onClick={()=>setIsEditOpen(false)}>View Revision on Portfolio</button></details>}
  </div>;
}
