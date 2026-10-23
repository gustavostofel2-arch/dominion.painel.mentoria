/** Uma dúvida de aluno: a pergunta como foi escrita, a resposta que recebeu e quem respondeu. */
type Autor = { nome: string; eh_equipe?: boolean } | null | undefined;

export type DuvidaDados = {
  pergunta_texto: string | null;
  pergunta_autor?: Autor;
  resposta_texto: string | null;
  resposta_autor?: Autor;
  tempo_resposta_min: number | null;
  resposta_resumo: string | null;
  respondida_por: "equipe" | "colegas" | null;
};

function tempo(min: number | null): string {
  if (min === null) return "";
  if (min < 1) return " · na hora";
  if (min < 90) return ` · ${min} min depois`;
  const h = Math.round(min / 60);
  return ` · ${h} h depois`;
}

export default function Duvida({
  pergunta,
  resposta,
  sugestao,
  mostrarSugestao,
}: {
  pergunta: DuvidaDados;
  resposta: DuvidaDados | null;
  sugestao: string | null;
  mostrarSugestao: boolean;
}) {
  const respostaTexto = resposta?.resposta_texto ?? null;
  const resumo = !respostaTexto ? (resposta?.resposta_resumo ?? pergunta.resposta_resumo) : null;
  const autorResposta = resposta?.resposta_autor;
  const papel = autorResposta?.eh_equipe || resposta?.respondida_por === "equipe" ? "equipe" : "colega";

  return (
    <>
      {pergunta.pergunta_texto && (
        <blockquote className="citacao">
          <div className="quem">{pergunta.pergunta_autor?.nome ?? "Aluno"} perguntou</div>
          <p>{pergunta.pergunta_texto}</p>
        </blockquote>
      )}
      {respostaTexto && resposta && (
        <blockquote className={papel === "equipe" ? "citacao resp equipe" : "citacao resp"}>
          <div className="quem">
            {autorResposta?.nome ?? (papel === "equipe" ? "Equipe" : "Colega")}{" "}
            <span className="tag t-neu">{papel}</span> respondeu
            {tempo(resposta.tempo_resposta_min)}
          </div>
          <p>{respostaTexto}</p>
        </blockquote>
      )}
      {resumo && (
        <div className="porque">
          <b>Resposta:</b> {resumo}
        </div>
      )}
      {mostrarSugestao && sugestao && (
        <div className="sugestao">
          <b>Sugestão para a equipe:</b> {sugestao}
        </div>
      )}
    </>
  );
}
