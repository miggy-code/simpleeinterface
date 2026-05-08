/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Airtable + Instantly responses can be large; bump body limit.
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
};

export default nextConfig;
