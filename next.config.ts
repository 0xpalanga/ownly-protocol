import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: `
              default-src 'self';
              script-src 'self' 'unsafe-eval' 'unsafe-inline';
              connect-src 'self'
                https://fullnode.testnet.sui.io
                https://infragrid.v.network
                https://firestore.googleapis.com
                https://*.googleapis.com
                https://*.gstatic.com;
              style-src 'self' 'unsafe-inline';
              img-src 'self' data:;
            `.replace(/\s{2,}/g, " ").trim(),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
