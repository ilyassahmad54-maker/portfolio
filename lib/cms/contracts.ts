import type { PortfolioData } from '../../types/portfolio';

export interface CmsState {
  version: number;
  publishedRevisionId: string;
  draftRevisionId: string;
  hasDraft: boolean;
  updatedAt: string;
}
export interface DraftSnapshot { state: CmsState; revisionId: string; content: PortfolioData }
export interface PublishedSnapshot { revisionId: string; sequence: number; content: PortfolioData }
export interface ChangeResult { state: CmsState; revisionId: string; replayed: boolean }
export interface WorkflowRequest { expectedVersion: number; requestId: string; draftRevisionId?: string; content?: PortfolioData; confirmed?: boolean; targetRevisionId?: string }
export type CmsOperation = 'published' | 'draft' | 'preview' | 'state' | 'save' | 'publish' | 'discard' | 'history' | 'revision' | 'restore' | 'upload' | 'asset' | 'assetPreview';
export interface CmsStore {
  history(limit: number, before: number | null): Promise<RevisionHistory>;
  revision(id: string): Promise<HistoricalRevision>;
  restore(request: WorkflowRequest): Promise<ChangeResult>;
  published(): Promise<PublishedSnapshot>;
  draft(): Promise<DraftSnapshot>;
  state(): Promise<CmsState>;
  save(request: WorkflowRequest): Promise<ChangeResult>;
  publish(request: WorkflowRequest): Promise<ChangeResult>;
  discard(request: WorkflowRequest): Promise<ChangeResult>;
}

export interface RevisionSummary { revisionId: string; sequence: number; createdAt: string; operation: 'seed' | 'draft' | 'publish' | 'restore' }
export interface RevisionHistory { items: RevisionSummary[]; nextCursor: number | null; state: CmsState }
export interface HistoricalRevision extends RevisionSummary { content: PortfolioData; state: CmsState }
