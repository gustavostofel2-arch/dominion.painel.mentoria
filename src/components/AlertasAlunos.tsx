/** Alunos que parecem insatisfeitos (a IA aponta; o texto é a mensagem real do aluno). */
export type AlertaResumo = {
  id: string;
  nome: string;
  nivel: number;
  dias: number;
  motivo: string;
  citacao: string | null;
};

const ROTULO: Record<number, string> = { 1: "Atenção leve", 2: "Insatisfeito", 3: "Muito insatisfeito" };

export default function AlertasAlunos({
  alertas,
  titulo = "Alunos para acompanhar",
}: {
  alertas: AlertaResumo[];
  titulo?: string;
}) {
  return (
    <section className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <h2 className="h2">{titulo}</h2>
        <span className="tag t-critica">
          {alertas.length} {alertas.length === 1 ? "aluno" : "alunos"}
        </span>
      </div>
      <p className="sub">Reclamações e frustrações vistas no período. Vale alguém da equipe falar com cada um.</p>
      {alertas.map((a) => (
        <div className="topico" key={a.id}>
          <div className="meta">
            <b>{a.nome}</b>
            <span className={a.nivel >= 3 ? "tag t-dor" : a.nivel === 2 ? "tag t-critica" : "tag t-neu"}>
              {ROTULO[a.nivel] ?? "Atenção"}
            </span>
            {a.dias > 1 && <span className="tag t-neu">em {a.dias} dias</span>}
          </div>
          <p className="txt" style={{ marginTop: 6 }}>
            {a.motivo}
          </p>
          {a.citacao && (
            <blockquote className="citacao">
              <p>{a.citacao}</p>
            </blockquote>
          )}
        </div>
      ))}
    </section>
  );
}
