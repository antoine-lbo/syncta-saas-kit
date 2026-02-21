/** @type {import("next").NextConfig} */
const nextConfig = {
  // ---------------------------------------------------------------------------
  // Core
  // ---------------------------------------------------------------------------
  reactStrictMode: true,
  poweredByHeader: false,

  // ---------------------------------------------------------------------------
  // Images
  // ---------------------------------------------------------------------------
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
      },
    ],
  },

  // ---------------------------------------------------------------------------
  // Security headers
  // ---------------------------------------------------------------------------
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },

  // ---------------------------------------------------------------------------
  // Redirects
  // ---------------------------------------------------------------------------
  async redirects() {
    return [
      {
        source: "/app",
        destination: "/",
        permanent: true,
      },
      {
        source: "/dashboard",
        destination: "/",
        permanent: false,
      },
    ];
  },

  // ---------------------------------------------------------------------------
  // Experimental features
  // ---------------------------------------------------------------------------
  experimental: {
    // Enable server actions for form mutations
    serverActions: {
      bodySizeLimit: "2mb",
    },
    // Optimize package imports for smaller bundles
    optimizePackageImports: [
      "lucide-react",
      "recharts",
      "@supabase/supabase-js",
    ],
  },

  // ---------------------------------------------------------------------------
  // Logging
  // ---------------------------------------------------------------------------
  logging: {
    fetches: {
      fullUrl: process.env.NODE_ENV === "development",
    },
  },

  // ---------------------------------------------------------------------------
  // Webpack customisation
  // ---------------------------------------------------------------------------
  webpack: (config, { isServer }) => {
    // Suppress critical dependency warnings from Supabase realtime
    config.module.exprContextCritical = false;

    if (!isServer) {
      // Prevent Node.js modules from being bundled client-side
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
      };
    }

    return config;
  },
};

export default nextConfig;
