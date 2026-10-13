import { createAssetHandler } from '../../../../../lib/cms/asset-http';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const revalidate=0;
export const POST=createAssetHandler('upload');
