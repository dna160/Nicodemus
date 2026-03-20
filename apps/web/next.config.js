/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['shared'],
  serverExternalPackages: ['@supabase/supabase-js'],
  experimental: {
    isrMemoryCacheSize: 0,
  },
  // Disable static generation for error pages during build
  onDemandEntries: {
    maxInactiveAge: 60 * 1000,
    pagesBufferLength: 5,
  },
};

export default nextConfig;
