/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: __dirname,
  // Publish/restore verify baseline files locally before changing database pointers.
  outputFileTracingIncludes: {
    '/api/admin/content/publish': require('./lib/cms/legacy-assets.json').map(asset => './public' + asset.path),
    '/api/admin/content/restore': require('./lib/cms/legacy-assets.json').map(asset => './public' + asset.path),
  },
  images: {
    formats: ['image/avif', 'image/webp'],
  },
};

module.exports = nextConfig;
