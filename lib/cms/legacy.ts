import type { PortfolioData } from '../../types/portfolio';
export interface ImportChange { id:string; label:string; path:string[]; before:unknown; after:unknown; kind:'field'|'add'|'remove'|'order' }
const collections=['projects','skills','experience','education','certifications'] as const;
const equal=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
export function compareImport(current:PortfolioData, raw:string):ImportChange[] {
  if(new TextEncoder().encode(raw).length>32*1024*1024)throw new Error('Import exceeds 32 MiB.');
  const candidate=JSON.parse(raw,(key,value)=>{if(['__proto__','constructor','prototype'].includes(key))throw new Error('Unsafe import field.');return value;});
  if(!candidate || typeof candidate!=='object' || Array.isArray(candidate) || !candidate.profile || !Array.isArray(candidate.projects))throw new Error('Invalid portfolio export.');
  // Historical exports may have included this obsolete field. It is never imported.
  delete candidate.adminPasscode;
  const changes:ImportChange[]=[];
  const add=(path:string[],before:unknown,after:unknown,kind:ImportChange['kind']='field')=>{
    if(!equal(before,after))changes.push({id:String(changes.length),label:path.join(' / '),path,before,after,kind});
  };
  for(const key of Object.keys(current.profile))if(Object.hasOwn(candidate.profile,key))add(['profile',key],current.profile[key as keyof PortfolioData['profile']],candidate.profile[key]);
  for(const section of collections) {
    if(!Object.hasOwn(candidate,section))continue;
    const incoming=candidate[section];
    if(!Array.isArray(incoming) || incoming.some(item=>!item || typeof item.id!=='string') || new Set(incoming.map(item=>item.id)).size!==incoming.length)throw new Error('Invalid or duplicate collection IDs.');
    const existing=current[section] as unknown as Record<string,unknown>[];
    for(const item of incoming){
      const old=existing.find(row=>row.id===item.id);
      if(!old)add([section,item.id],undefined,item,'add');
      else for(const field of new Set([...Object.keys(old),...Object.keys(item)]))if(field!=='id')add([section,item.id,field],old[field],item[field]);
    }
    for(const item of existing)if(!incoming.some(row=>row.id===item.id))add([section,String(item.id)],item,undefined,'remove');
    add([section],existing.map(item=>item.id),incoming.map(item=>item.id),'order');
  }
  for(const section of ['socialLinks','stats','navItems'] as const)if(Object.hasOwn(candidate,section))add([section],current[section],candidate[section]);
  return changes;
}
export function applyImport(current:PortfolioData, changes:ImportChange[], selected:string[]):PortfolioData {
  const next=structuredClone(current) as unknown as Record<string,unknown>;
  // Apply order after additions/removals. Unselected/current-only records are retained.
  const chosen=changes.filter(change=>selected.includes(change.id));
  for(const change of chosen.filter(change=>change.kind!=='order')) {
    const [section,itemId,field]=change.path;
    if(collections.includes(section as typeof collections[number])){
      const items=next[section] as Record<string,unknown>[];
      const index=items.findIndex(item=>item.id===itemId);
      const actual=field?items[index]?.[field]:items[index];
      if(!equal(actual,change.before))throw new Error('Content changed since comparison. Compare again before importing.');
      if(change.kind==='add')items.push(structuredClone(change.after) as Record<string,unknown>);
      else if(change.kind==='remove')items.splice(index,1);
      else if(change.after===undefined)delete items[index][field];
      else items[index][field]=structuredClone(change.after);
    }else if(section==='profile'){
      const profile=next.profile as Record<string,unknown>;
      if(!equal(profile[itemId],change.before))throw new Error('Content changed since comparison.');
      profile[itemId]=structuredClone(change.after);
    }else {
      if(!equal(next[section],change.before))throw new Error('Content changed since comparison.');
      next[section]=structuredClone(change.after);
    }
  }
  for(const change of chosen.filter(change=>change.kind==='order')){
    const section=change.path[0],items=next[section] as Record<string,unknown>[];
    const original=current[section as typeof collections[number]].map(item=>item.id);
    if(!equal(original,change.before))throw new Error('Order changed since comparison.');
    const wanted=change.after as string[];
    next[section]=[...wanted.flatMap(id=>items.filter(item=>item.id===id)),...items.filter(item=>!wanted.includes(String(item.id)))];
  }
  return next as unknown as PortfolioData;
}
export function reorderProject(data:PortfolioData,id:string,direction:-1|1):PortfolioData {
  const projects=[...data.projects],index=projects.findIndex(project=>project.id===id),target=index+direction;
  if(index<0 || target<0 || target>=projects.length)return data;
  [projects[index],projects[target]]=[projects[target],projects[index]];
  return {...data,projects};
}
export function imageSource(reference:string,preview:boolean):string {
  if(/^\/api\/assets\/[0-9a-f-]{36}$/.test(reference))return preview?reference.replace('/api/assets/','/api/admin/assets/'):reference;
  if(/^\/assets\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+\.(png|jpe?g|webp|gif)$/.test(reference))return reference;
  return '/assets/projects/multimodal-ai.jpg';
}
