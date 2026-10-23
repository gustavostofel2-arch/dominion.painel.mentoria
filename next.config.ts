import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Os dados só mudam uma vez por dia. Uma tela já aberta fica guardada no navegador por 30 minutos,
    // então voltar para uma aba que você acabou de ver é instantâneo (sem nova consulta ao banco).
    // Marcar uma ação como feita limpa esse guardado na hora.
    staleTimes: { dynamic: 1800, static: 1800 },
  },
};

export default nextConfig;
