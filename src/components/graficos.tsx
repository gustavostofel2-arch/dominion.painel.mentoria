/** Gráficos simples em SVG, sem biblioteca. */

function pontos(valores: number[], largura: number, altura: number, folga = 4): string {
  if (valores.length === 0) return "";
  const max = Math.max(...valores, 1);
  const min = Math.min(...valores, 0);
  const faixa = max - min || 1;
  const passo = valores.length > 1 ? largura / (valores.length - 1) : 0;
  return valores
    .map((v, i) => {
      const x = (i * passo).toFixed(1);
      const y = (folga + (altura - folga * 2) * (1 - (v - min) / faixa)).toFixed(1);
      return `${x},${y}`;
    })
    .join(" ");
}

export function Spark({
  valores,
  cor = "#9d9ca6",
  rotulo,
}: {
  valores: number[];
  cor?: string;
  rotulo: string;
}) {
  return (
    <svg viewBox="0 0 60 24" width="60" height="24" role="img" aria-label={rotulo}>
      <polyline
        points={pontos(valores, 60, 24, 3)}
        fill="none"
        stroke={cor}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Linha({
  valores,
  cor = "#ffb020",
  area = false,
  altura = 120,
  rotulo,
}: {
  valores: number[];
  cor?: string;
  area?: boolean;
  altura?: number;
  rotulo: string;
}) {
  const largura = 480;
  const pts = pontos(valores, largura, altura);
  return (
    <svg
      viewBox={`0 0 ${largura} ${altura}`}
      width="100%"
      height={altura}
      preserveAspectRatio="none"
      role="img"
      aria-label={rotulo}
      style={{ display: "block" }}
    >
      {area && pts && (
        <polygon points={`0,${altura} ${pts} ${largura},${altura}`} fill={cor} opacity="0.12" />
      )}
      <polyline
        points={pts}
        fill="none"
        stroke={cor}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/** Barras verticais com rótulos; `destaque` marca a barra mais alta. */
export function Barras({
  itens,
  rotulo,
}: {
  itens: { rotulo: string; valor: number; parcial?: boolean }[];
  rotulo: string;
}) {
  const max = Math.max(...itens.map((i) => i.valor), 1);
  const alturaMax = 120;
  const largura = 480;
  const passo = largura / Math.max(itens.length, 1);
  const barra = Math.min(80, passo - 16);
  const pico = itens.findIndex((i) => i.valor === max);

  return (
    <svg viewBox="0 0 480 190" width="100%" role="img" aria-label={rotulo} style={{ display: "block" }}>
      {itens.map((item, i) => {
        const h = Math.max(4, Math.round((item.valor / max) * alturaMax));
        const x = i * passo + (passo - barra) / 2;
        return (
          <g key={i}>
            <rect
              x={x}
              y={160 - h}
              width={barra}
              height={h}
              rx={Math.min(10, h / 2)}
              fill={i === pico ? "#ffb020" : item.parcial ? "#3a3a44" : "#8ab4ff"}
            />
            <text x={x + barra / 2} y={160 - h - 6} textAnchor="middle" fontSize="12" fontWeight="700" fill="#9d9ca6">
              {item.valor.toLocaleString("pt-BR")}
            </text>
            <text x={x + barra / 2} y={182} textAnchor="middle" fontSize="12" fill="#9d9ca6">
              {item.rotulo}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
