/** Barras de mensagens por faixa de 2 horas; a faixa mais movimentada fica em destaque. */
export default function GraficoHorario({ porHora }: { porHora: number[] }) {
  if (porHora.length !== 24) {
    return <p className="sub">Sem dados por horário neste dia.</p>;
  }

  const faixas = Array.from({ length: 12 }, (_, i) => porHora[i * 2] + porHora[i * 2 + 1]);
  const maximo = Math.max(...faixas, 1);
  const pico = faixas.indexOf(Math.max(...faixas));
  const altura = 120;

  return (
    <svg
      viewBox="0 0 480 160"
      width="100%"
      role="img"
      aria-label={`Mensagens por horário, com pico entre ${pico * 2}h e ${pico * 2 + 2}h`}
      style={{ marginTop: 14, display: "block" }}
    >
      {faixas.map((valor, i) => {
        const h = Math.max(2, Math.round((valor / maximo) * altura));
        return (
          <rect
            key={i}
            x={i * 40 + 6}
            y={130 - h}
            width={28}
            height={h}
            rx={Math.min(8, h / 2)}
            fill={i === pico ? "#0E7C6B" : "#BFE3DC"}
          />
        );
      })}
      <g fontSize="11" fill="#55625F" textAnchor="middle">
        {[0, 4, 8, 12, 16, 20].map((hora) => (
          <text key={hora} x={(hora / 2) * 40 + 20} y={150}>
            {hora}h
          </text>
        ))}
      </g>
    </svg>
  );
}
