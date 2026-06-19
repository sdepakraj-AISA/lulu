/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow server-side MCP runtime to use Node.js APIs
  experimental: {
    serverComponentsExternalPackages: ['@modelcontextprotocol/sdk'],
  },
};

module.exports = nextConfig;
