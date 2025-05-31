/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@mysten/dapp-kit', '@mysten/sui.js', 'lru-cache'],
  webpack: (config, { isServer }) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      'lru-cache': require.resolve('lru-cache'),
    };
    // Force specific packages to use CommonJS
    config.module = {
      ...config.module,
      rules: [
        ...config.module.rules,
        {
          test: /\.m?js$/,
          type: "javascript/auto",
          resolve: {
            fullySpecified: false,
          },
        },
      ],
    };
    return config;
  },
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
              style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://*.gstatic.com;
              font-src 'self' data: https://fonts.gstatic.com;
              img-src 'self' data: https://*.gstatic.com;
            `.replace(/\s{2,}/g, " ").trim(),
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
