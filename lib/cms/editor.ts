import type { PortfolioData } from '../../types/portfolio';
import type { ChangeResult, DraftSnapshot, HistoricalRevision, RevisionHistory } from './contracts';
import type { PublicContent } from './public-content';
import { validatePortfolio } from './validation';
import { applyImport, compareImport, type ImportChange } from './legacy';
export class EditorError extends Error { constructor(readonly status:number,message:string){super(message);} }
export interface EditorState {
  published:PublicContent; working:PortfolioData|null; saved:DraftSnapshot|null;
  authenticated:boolean; expired:boolean; busy:boolean; status:string; error:string|null;
  view:'published'|'working'|'saved'|'revision'; preview:PortfolioData|null;
  history:RevisionHistory|null; selected:HistoricalRevision|null;
  legacy:string|null; legacyHidden:boolean; importChanges:ImportChange[]; conflict:boolean;
}
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
export class PortfolioEditor {
  private state:EditorState;
  private authEpoch=0;
  private listeners=new Set<()=>void>();
  private pending:{signature:string;requestId:string}|null=null;
  constructor(published:PublicContent,private fetcher:typeof fetch=(...args)=>fetch(...args),private uuid:()=>string=()=>crypto.randomUUID()) {
    this.state={published,working:null,saved:null,authenticated:false,expired:false,busy:false,status:'Published content',error:null,view:'published',preview:null,history:null,selected:null,legacy:null,legacyHidden:false,importChanges:[],conflict:false};
  }
  snapshot=()=>this.state;
  subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>{this.listeners.delete(listener);};};
  private patch(value:Partial<EditorState>){this.state={...this.state,...value};this.listeners.forEach(listener=>listener());}
  get dirty(){return !!this.state.working && (!this.state.saved || !same(this.state.working,this.state.saved.content));}
  get display(){return this.state.authenticated && this.state.view!=='published' ? (this.state.view==='working'?this.state.working:this.state.preview)||this.state.published.content : this.state.published.content;}
  edit= (update:PortfolioData|((current:PortfolioData)=>PortfolioData))=>{
    if(!this.state.working)return;
    this.patch({working:typeof update==='function'?update(this.state.working):update,status:'Unsaved changes',error:null});
  };
  private async json<T>(url:string,body?:unknown):Promise<T>{
    let response:Response;
    try{response=await this.fetcher(url,{method:body===undefined?'GET':'POST',cache:'no-store',credentials:'same-origin',...(body===undefined?{}:{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),signal:AbortSignal.timeout(30000)});}
    catch{throw new EditorError(503,'Request failed or timed out. Your edits are still in memory. Retry the same operation.');}
    if(!response.ok){
      if(response.status===401)this.patch({authenticated:false,expired:true,view:'published'});
      throw new EditorError(response.status,response.status===409?'Content changed elsewhere. Export your work, then load the saved draft and compare before saving again.':response.status===401?'Session expired. Sign in again; your unsaved edits are still in memory.':response.status===429?'Too many requests. Wait and retry.':'Request failed. Your edits are still in memory.');
    }
    try{return await response.json();}catch{throw new EditorError(503,'Invalid server response. Retry the same operation.');}
  }
  private async run(label:string,action:()=>Promise<void>):Promise<boolean>{
    if(this.state.busy)return false;
    this.patch({busy:true,status:label,error:null});
    try{await action();return true;}
    catch(error){const known=error instanceof EditorError;this.patch({status:'Failed',error:known?error.message:error instanceof Error?error.message:'Operation failed.',conflict:known&&error.status===409});return false;}
    finally{this.patch({busy:false});}
  }
  private async mutate(operation:'save'|'publish'|'discard'|'restore',body:Record<string,unknown>):Promise<ChangeResult>{
    if(!this.state.authenticated)throw new EditorError(401,'Sign in again; your edits are preserved.');
    const signature=JSON.stringify({operation,...body});
    if(this.pending && this.pending.signature!==signature)throw new EditorError(409,'A previous request has an uncertain outcome. Retry it unchanged or explicitly load the saved draft before starting another operation.');
    if(!this.pending)this.pending={signature,requestId:this.uuid()};
    try{
      const result=await this.json<ChangeResult>(operation==='save'?'/api/admin/content/draft':`/api/admin/content/${operation}`,{...body,requestId:this.pending.requestId});
      this.pending=null;return result;
    }catch(error){if(error instanceof EditorError && error.status<500 && ![408,429,401].includes(error.status))this.pending=null;throw error;}
  }
  checkSession=async()=>{
    const epoch=++this.authEpoch;
    try{const response=await this.fetcher('/api/admin/session',{cache:'no-store',credentials:'same-origin',signal:AbortSignal.timeout(10000)});if(epoch!==this.authEpoch)return this.state.authenticated;this.patch({authenticated:response.ok,...(!response.ok?{view:'published' as const,expired:this.state.working!==null}:{} )});return response.ok;}
    catch{if(epoch===this.authEpoch)this.patch({authenticated:false,view:'published',expired:this.state.working!==null});return false;}
  };
  login=async(passcode:string)=>{
    ++this.authEpoch;
    try{await this.json('/api/admin/login',{passcode});this.patch({authenticated:true,expired:false,error:null});return true;}catch{return false;}
  };
  load=async(confirmed=false)=>this.run('Loading saved draft…',async()=>{
    if(this.dirty&&!confirmed)throw new Error('Confirm replacing unsaved editor changes before loading.');
    const draft=await this.json<DraftSnapshot>('/api/admin/content/draft');validatePortfolio(draft.content);
    this.pending=null;this.patch({saved:draft,working:structuredClone(draft.content),view:'published',preview:null,conflict:false,status:'Saved draft loaded'});
  });
  save=async()=>this.run('Saving draft…',async()=>{
    if(!this.state.working||!this.state.saved)throw new Error('Load a saved draft first.');
    const content=structuredClone(this.state.working);validatePortfolio(content);
    const result=await this.mutate('save',{content,expectedVersion:this.state.saved.state.version});
    this.patch({saved:{content,revisionId:result.revisionId,state:result.state},status:'Draft saved',conflict:false});
  });
  previewSaved=async()=>this.run('Loading saved preview…',async()=>{
    const draft=await this.json<DraftSnapshot>('/api/admin/content/preview');validatePortfolio(draft.content);
    this.patch({preview:draft.content,view:'saved',status:`Previewing saved draft ${draft.revisionId.slice(0,8)} (version ${draft.state.version}) — unpublished`});
  });
  previewWorking=()=>{try{validatePortfolio(this.state.working);this.patch({view:'working',status:'Previewing unsaved edits — unpublished',error:null});return true;}catch{this.patch({error:'Correct invalid fields before previewing.',status:'Preview failed'});return false;}};
  showPublished=()=>this.patch({view:'published',preview:null,status:this.dirty?'Unsaved changes':'Published content'});
  refreshPublic=async()=>{
    try{
      const incoming=await this.json<PublicContent>('/api/content/published');validatePortfolio(incoming.content);
      const previous=this.state.published;
      // Preserve newer in-memory published data during outage/late old responses.
      if(previous.sequence!==null && (incoming.sequence===null || incoming.sequence<previous.sequence))this.patch({published:{...previous,readOnly:true,source:'last-known-published'}});
      else this.patch({published:incoming});
    }catch{this.patch({published:{...this.state.published,readOnly:true}});}
  };
  publish=async(confirmed=false)=>this.run('Publishing…',async()=>{
    if(!confirmed)throw new Error('Confirm publication first.');
    if(this.dirty||!this.state.saved)throw new Error('Save your changes before publishing.');
    const content=this.state.saved.content;
    const result=await this.mutate('publish',{expectedVersion:this.state.saved.state.version,draftRevisionId:this.state.saved.revisionId});
    this.patch({saved:{state:result.state,revisionId:result.revisionId,content},view:'published',preview:null,status:'Published successfully'});
    await this.refreshPublic();
    if(this.state.published.readOnly)this.patch({status:'Publication completed; public refresh is degraded. Retry Show Published when services recover.'});
  });
  discard=async(confirmed=false)=>this.run('Discarding draft…',async()=>{
    if(!confirmed||!this.state.saved)throw new Error('Confirm discarding changes first.');
    await this.mutate('discard',{expectedVersion:this.state.saved.state.version,draftRevisionId:this.state.saved.revisionId,confirmed:true});
    this.patch({saved:null,view:'published',preview:null,status:'Discard completed; refreshing saved draft…'});
    try {
      const draft=await this.json<DraftSnapshot>('/api/admin/content/draft');validatePortfolio(draft.content);
      this.patch({saved:draft,working:structuredClone(draft.content),status:'Draft discarded',conflict:false});
    } catch { this.patch({status:'Discard completed on server; reload required',error:'Saved draft refresh failed. Export retained editor work, then Load Saved Draft before another operation.'}); }
  });
  history=async(more=false)=>this.run('Loading revision history…',async()=>{
    const cursor=more?this.state.history?.nextCursor:null;
    if(more&&!cursor)return;
    const page=await this.json<RevisionHistory>(`/api/admin/content/history?limit=10${cursor?`&before=${cursor}`:''}`);
    this.patch({history:{...page,items:more?[...(this.state.history?.items||[]),...page.items]:page.items},status:'Revision history loaded'});
  });
  viewRevision=async(id:string)=>this.run('Loading revision…',async()=>{
    const selected=await this.json<HistoricalRevision>(`/api/admin/content/revision?id=${encodeURIComponent(id)}`);validatePortfolio(selected.content);
    this.patch({selected,preview:selected.content,view:'revision',status:`Previewing historical ${selected.operation} revision — not published by this action`});
  });
  restore=async(id:string,confirmed=false)=>this.run('Restoring publication…',async()=>{
    if(!confirmed||!this.state.saved)throw new Error('Confirm restoring a publication first.');
    const wasDirty=this.dirty;
    await this.mutate('restore',{targetRevisionId:id,expectedVersion:this.state.saved.state.version});
    this.patch({saved:null,view:'published',preview:null,status:'Restore completed; refreshing saved draft…'});
    try {
      const saved=await this.json<DraftSnapshot>('/api/admin/content/draft');validatePortfolio(saved.content);
      this.patch({saved,...(!wasDirty?{working:structuredClone(saved.content)}:{}),status:'Published version restored; independent editor work preserved'});
    } catch { this.patch({status:'Restore completed on server; reload required',error:'Saved draft refresh failed. Export retained editor work, then Load Saved Draft before another operation.'}); }
    await this.refreshPublic();
  });
  upload=async(file:Blob):Promise<string>=>{
    if(!this.state.authenticated)throw new EditorError(401,'Sign in before uploading.');
    if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>4194304||!file.size)throw new Error('Choose a JPEG, PNG or WebP up to 4 MiB.');
    let response:Response;
    try{response=await this.fetcher('/api/admin/assets/upload',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':file.type},body:file,signal:AbortSignal.timeout(30000)});}catch{throw new Error('Upload failed. Select the file again to retry.');}
    if(!response.ok){if(response.status===401)this.patch({authenticated:false,expired:true,view:'published'});throw new Error(response.status===401?'Session expired; sign in and retry the upload.':'Upload failed. Select the file again to retry.');}
    const result=await response.json();
    if(typeof result.image!=='string'||!/^\/api\/assets\/[0-9a-f-]{36}$/.test(result.image))throw new Error('Invalid upload response.');
    return result.image;
  };
  replaceImage=async(file:Blob,target:string)=>this.run('Uploading image…',async()=>{
    const reference=await this.upload(file);
    this.edit(current=>target==='profile'?{...current,profile:{...current.profile,profileImage:reference}}:{...current,projects:current.projects.map(project=>project.id===target?{...project,image:reference}:project)});
    this.patch({status:'Image uploaded into editor — Save Draft, then Publish'});
  });
  acceptPublic=(published:PublicContent)=>{
    if(this.state.published.sequence===null || (published.sequence!==null && published.sequence>=this.state.published.sequence))this.patch({published});
  };
  setLegacy=(raw:string|null)=>this.patch({legacy:raw,...(raw!==this.state.legacy?{legacyHidden:false}:{})});
  dismissLegacy=()=>this.patch({legacyHidden:true});
  compare=(raw:string)=>{try{if(!this.state.working)throw new Error('Load a saved draft first.');this.patch({importChanges:compareImport(this.state.working,raw),error:null});return true;}catch(error){this.patch({error:error instanceof Error?error.message:'Invalid import.'});return false;}};
  importSelected=async(ids:string[])=>this.run('Preparing selected changes…',async()=>{
    if(!this.state.working||!ids.length)throw new Error('Select changes to import.');
    const next=applyImport(this.state.working,this.state.importChanges,ids);
    for(const item of [next.profile,...next.projects]){
      const key='profileImage' in item?'profileImage':'image';const value=(item as unknown as Record<string,string>)[key];
      if(!value?.startsWith('data:'))continue;
      const match=/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
      if(!match||match[2].length>Math.ceil(4194304/3)*4)throw new Error('Embedded image is unsupported or too large. Upload a new image instead.');
      const binary=atob(match[2]),bytes=Uint8Array.from(binary,char=>char.charCodeAt(0));
      (item as unknown as Record<string,string>)[key]=await this.upload(new Blob([bytes],{type:match[1]}));
    }
    validatePortfolio(next);this.edit(next);this.patch({importChanges:[],status:'Selected changes imported into editor memory — Save Draft to retain them'});
  });
  clearComparison=()=>this.patch({importChanges:[]});
  logout=async()=>this.run('Logging out…',async()=>{await this.json('/api/admin/logout',{});++this.authEpoch;this.patch({authenticated:false,expired:false,view:'published',preview:null,history:null,selected:null,status:'Logged out; editor work retained in memory'});});
}
