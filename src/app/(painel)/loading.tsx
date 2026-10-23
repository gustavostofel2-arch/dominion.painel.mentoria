/** Aparece na hora ao trocar de tela, enquanto os dados chegam. */
export default function Carregando() {
  return (
    <div className="carregando" aria-busy="true" aria-live="polite">
      <div className="esq esq-titulo" />
      <div className="esq esq-linha" />
      <div className="grid4">
        {[0, 1, 2, 3].map((i) => (
          <div className="card esq-card" key={i}>
            <div className="esq esq-linha" style={{ width: "60%" }} />
            <div className="esq esq-numero" />
            <div className="esq esq-linha" style={{ width: "80%" }} />
          </div>
        ))}
      </div>
      <div className="card esq-card" style={{ minHeight: 200 }}>
        <div className="esq esq-linha" style={{ width: "40%" }} />
        <div className="esq esq-linha" />
        <div className="esq esq-linha" style={{ width: "90%" }} />
      </div>
    </div>
  );
}
