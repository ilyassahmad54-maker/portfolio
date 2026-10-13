import manifest from './legacy-assets.json';
import type { PortfolioData } from '../../types/portfolio';
import { CmsHttpError } from './errors';

const allowed = new Set(manifest.map(asset => asset.path));
/** Managed references are resolved through protected inventory functions, never arbitrary URLs. */
export function requirePublishableAssets(content: PortfolioData): void {
  const paths = [content.profile.profileImage, content.profile.cvUrl, ...content.projects.map(project => project.image)];
  if (paths.some(path => !allowed.has(path) && !/^\/api\/assets\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(path))) throw new CmsHttpError(422, 'An image or CV reference is not verified for publication.');
}
