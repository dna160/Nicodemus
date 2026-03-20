/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['shared'],
  serverExternalPackages: ['@supabase/supabase-js'],
};

export default nextConfig;
