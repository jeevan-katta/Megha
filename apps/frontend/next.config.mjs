const apiOrigin = (process.env.BACKEND_URL || 'http://127.0.0.1:5000').replace(/\/$/, '');
if (process.env.VERCEL && !process.env.BACKEND_URL)
  throw new Error('Set BACKEND_URL to the deployed backend URL.');
if (process.env.VERCEL && !process.env.SITE_URL)
  throw new Error('Set SITE_URL to the deployed frontend URL.');
export default {
  poweredByHeader: false,
  transpilePackages: ['@megha/types', '@megha/constants', '@megha/validation', '@megha/ui'],
  async rewrites() {
    return [{ source: '/api/:path*', destination: apiOrigin + '/api/:path*' }];
  },
};
