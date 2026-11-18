/** @type {import('next').NextConfig} */
const nextConfig = {
  /* Retain the entire original app, served at /music through the CAFE Funnel proxy. */
  basePath: "/music",
  turbopack: { root: process.cwd() },
  outputFileTracingRoot: process.cwd(),
};

export default nextConfig;
