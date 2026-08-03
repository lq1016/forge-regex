import type { NextConfig } from "next";

const CN_WORKS = "https://www.ststudio.top/works/forge-regex";
const CN_PRICING = "https://www.ststudio.top/works/forge-regex/pricing";

const nextConfig: NextConfig = {
  // Hide the floating Next.js "N" badge in `next dev` (dev-only; never in production).
  devIndicators: false,
  async redirects() {
    return [
      {
        source: "/cn/pricing",
        destination: CN_PRICING,
        permanent: true,
      },
      {
        source: "/cn",
        destination: CN_WORKS,
        permanent: true,
      },
      {
        source: "/cn/:path*",
        destination: CN_WORKS,
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
