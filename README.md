# Painel Chat Alunos

Painel web (Next.js + Supabase + Vercel) para ver, dia a dia, o que os alunos falam no grupo:
dores, dúvidas, desejos, elogios, qualidade da mentoria e alunos que mais ajudam.

**Privacidade:** o sistema não guarda as mensagens dos alunos, só o que a IA extraiu delas
(temas, contagens e notas) e contagens por aluno.

## Estado atual

- [x] Login (Supabase Auth) e proteção das telas
- [x] Banco de dados (`supabase/schema.sql`) e dados de exemplo (`supabase/seed.sql`)
- [x] Telas: Visão geral, Resumo do dia, Histórico, Temas e dores, Dúvidas e qualidade, Alunos e Relatórios (semanal e mensal)
- [x] Os dados vêm do repositório `resumo-telegram` (GitHub Actions): `resumo.py` grava o dia e `relatorios.py` gera os relatórios semanal e mensal

O painel só **lê** o Supabase. Quem grava é o `resumo-telegram`, com a chave secreta (`SUPABASE_SECRET_KEY`),
que nunca deve aparecer neste repositório nem no painel.

## Como ligar (resumo)

1. Criar o projeto no Supabase e rodar `supabase/schema.sql` no SQL Editor.
2. (Opcional) rodar `supabase/seed.sql` para ver dados de exemplo.
3. Criar o seu usuário em Authentication > Users e liberar o acesso:

   ```sql
   insert into membros_painel (user_id, nome, papel)
   select id, 'Seu Nome', 'admin' from auth.users where email = 'SEU_EMAIL';
   ```

4. Copiar `.env.example` para `.env.local` e preencher as duas variáveis.
5. `npm install` e `npm run dev`, depois abrir http://localhost:3000.

## Deploy

Vercel: importar o repositório do GitHub e cadastrar as mesmas duas variáveis em
Settings > Environment Variables.
