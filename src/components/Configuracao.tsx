/** Mostrado enquanto o .env.local (ou as variáveis do Vercel) ainda não foi preenchido. */
export default function Configuracao() {
  return (
    <div className="card" style={{ maxWidth: 560 }}>
      <h2 className="h2">Falta ligar o Supabase</h2>
      <p className="txt" style={{ marginTop: 10 }}>
        O painel ainda não sabe onde está o seu banco de dados. Preencha estas duas variáveis:
      </p>
      <ul className="txt" style={{ marginTop: 8, paddingLeft: 20 }}>
        <li>
          <code>NEXT_PUBLIC_SUPABASE_URL</code>
        </li>
        <li>
          <code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code>
        </li>
      </ul>
      <p className="sub" style={{ marginTop: 12 }}>
        No seu computador, elas ficam no arquivo <code>.env.local</code> (modelo em{" "}
        <code>.env.example</code>). No Vercel, em Settings, Environment Variables. Depois,
        reinicie o app.
      </p>
    </div>
  );
}
