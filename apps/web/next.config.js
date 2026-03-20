/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['shared'],
  serverExternalPackages: ['@supabase/supabase-js'],
};

module.exports = nextConfig;
