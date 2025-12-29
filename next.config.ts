import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/admin/ramos",
        destination: "/admin/categorias",
        permanent: false,
      },
      {
        source: "/admin/filiais/:id/ramos",
        destination: "/admin/filiais/:id/categorias",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
