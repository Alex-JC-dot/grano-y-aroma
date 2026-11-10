import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  // /tienda/ → tienda/index.html: así Render (sitio estático) sirve cada página sin reglas extra.
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
