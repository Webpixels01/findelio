import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const directusPublicUrl = process.env.DIRECTUS_PUBLIC_URL?.trim();
const directusRemotePattern = (() => {
  if (!directusPublicUrl) return null;

  try {
    const url = new URL(directusPublicUrl);
    if (!['http:', 'https:'].includes(url.protocol)) return null;

    return {
      protocol: url.protocol.slice(0, -1) as "http" | "https",
      hostname: url.hostname,
      port: url.port,
      pathname: "/assets/**",
    };
  } catch {
    return null;
  }
})();

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,

  images: {
    dangerouslyAllowLocalIP: true,
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
        port: "8055",
        pathname: "/assets/**",
      },
      ...(directusRemotePattern ? [directusRemotePattern] : []),
    ],
  },
};

export default withNextIntl(nextConfig);
