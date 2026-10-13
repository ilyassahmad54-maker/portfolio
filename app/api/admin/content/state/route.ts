import { cmsRoute } from '@/lib/cms/routes';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = cmsRoute('state');
