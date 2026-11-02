import Link from "next/link";
import type { Periodo } from "@/lib/ranking";

/** Escolha do período: 7 dias, 30 dias, a competição ou um intervalo de datas. */
export default function SeletorPeriodo({
  periodo,
  caminho,
  extra = "",
}: {
  periodo: Periodo;
  caminho: string;
  /** Parâmetros que devem continuar na URL (ex.: nomes=0). */
  extra?: string;
}) {
  const sufixo = extra ? `&${extra}` : "";
  const opcoes = [
    { chave: "7", rotulo: "7 dias", href: `${caminho}?periodo=7${sufixo}` },
    { chave: "30", rotulo: "30 dias", href: `${caminho}?periodo=30${sufixo}` },
    { chave: "comp", rotulo: "Competição", href: `${caminho}?periodo=comp${sufixo}` },
  ];
  const [nomesChave, nomesValor] = extra ? extra.split("=") : [];

  return (
    <div className="seletor-periodo">
      <div className="pills">
        {opcoes.map((o) => (
          <Link key={o.chave} href={o.href} className={periodo.chave === o.chave ? "pill on" : "pill"}>
            {o.rotulo}
          </Link>
        ))}
        <span className={periodo.chave === "custom" ? "pill on" : "pill"} aria-current={periodo.chave === "custom"}>
          Personalizado
        </span>
      </div>
      <form method="get" action={caminho} className="periodo-form">
        <input type="hidden" name="periodo" value="custom" />
        {nomesChave && <input type="hidden" name={nomesChave} value={nomesValor} />}
        <label>
          <span>De</span>
          <input type="date" name="de" defaultValue={periodo.desde} required />
        </label>
        <label>
          <span>Até</span>
          <input type="date" name="ate" defaultValue={periodo.ate} required />
        </label>
        <button type="submit" className="botao">
          Aplicar
        </button>
      </form>
      <div className="sub" style={{ marginTop: 0, flexBasis: "100%" }}>
        {periodo.rotulo}
      </div>
    </div>
  );
}
