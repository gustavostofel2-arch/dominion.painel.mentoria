/** Tela reservada para as próximas etapas da construção. */
export default function EmBreve({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <>
      <div className="top">
        <h1 className="titulo">{titulo}</h1>
      </div>
      <section className="card vazio">
        <h2>Em construção</h2>
        <p>{texto}</p>
      </section>
    </>
  );
}
