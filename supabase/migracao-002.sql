-- Migração 002: impede dois grupos com o mesmo nome (o resumo.py busca o grupo pelo nome).
-- Rode UMA vez no SQL Editor do Supabase.
--
-- PASSO 1: veja se já existe nome repetido. Se esta consulta devolver linhas, NÃO rode o passo 2:
-- os dados de um dos grupos repetidos precisam ser juntados ou apagados antes.
select nome, count(*) as vezes
from grupos
group by nome
having count(*) > 1;

-- PASSO 2: só se o passo 1 não devolveu nada.
alter table grupos add constraint grupos_nome_unico unique (nome);
