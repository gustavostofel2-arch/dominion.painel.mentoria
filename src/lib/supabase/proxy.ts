import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Renova a sessão de login a cada visita e manda para /login quem não entrou.
 * Se o Supabase ainda não foi configurado (.env.local vazio), deixa passar para
 * a página mostrar as instruções.
 */
export async function atualizarSessao(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chave = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !chave) return NextResponse.next({ request });

  let resposta = NextResponse.next({ request });

  const supabase = createServerClient(url, chave, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesParaGravar) {
        cookiesParaGravar.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        resposta = NextResponse.next({ request });
        cookiesParaGravar.forEach(({ name, value, options }) =>
          resposta.cookies.set(name, value, options),
        );
      },
    },
  });

  // getClaims confere o login localmente e renova a sessão quando precisa (sem chamada extra ao Supabase)
  const { data: claims } = await supabase.auth.getClaims();
  const user = claims?.claims ?? null;

  const naTelaDeLogin = request.nextUrl.pathname.startsWith("/login");

  if (!user && !naTelaDeLogin) {
    const destino = request.nextUrl.clone();
    destino.pathname = "/login";
    destino.search = "";
    return NextResponse.redirect(destino);
  }

  if (user && naTelaDeLogin) {
    const destino = request.nextUrl.clone();
    destino.pathname = "/";
    destino.search = "";
    return NextResponse.redirect(destino);
  }

  return resposta;
}
