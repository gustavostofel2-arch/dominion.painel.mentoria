/** Logo "Dominion // Mentory" em prata, desenhado em texto (nítido em qualquer tamanho). `tamanho` é o corpo da letra em px. */
export default function Logo({ tamanho = 22 }: { tamanho?: number }) {
  return (
    <span className="marca" style={{ fontSize: tamanho }} role="img" aria-label="Dominion Mentory">
      <span className="marca-d" aria-hidden="true">
        Dominion
      </span>
      <span className="marca-m" aria-hidden="true">
        <i>//</i>Mentory
      </span>
    </span>
  );
}
