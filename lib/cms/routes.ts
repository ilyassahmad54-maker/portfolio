import 'server-only';
import { readPublicContent } from './public-content';
import { revalidatePath } from 'next/cache';
import type { CmsOperation } from './contracts';
import { cmsStore } from './store';
import { authorizeCms, limitCms } from './security';
import { createCmsHandler } from './http';

export function cmsRoute(operation: CmsOperation) {
  return createCmsHandler(operation, {
    store: cmsStore, published: readPublicContent, authorize: authorizeCms, limit: limitCms,
    invalidate: async () => { revalidatePath('/'); revalidatePath('/api/content/published'); if((await readPublicContent()).readOnly)throw new Error('Published backup refresh pending'); },
    log: (action, category, status) => console.error(JSON.stringify({ event: 'cms_api', operation: action, category, status })),
  });
}
