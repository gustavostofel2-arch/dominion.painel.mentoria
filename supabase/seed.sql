-- =====================================================================
-- DADOS DE EXEMPLO (opcional): para ver o painel funcionando antes de ligar
-- o programa do GitHub. Tudo vai para um grupo chamado "Chat Alunos (EXEMPLO)".
-- Rode DEPOIS do schema.sql.
--
-- Para apagar tudo depois:
--   delete from grupos where nome like '%(EXEMPLO)%';
-- Pode rodar de novo: apaga o grupo de exemplo antigo e recria.
-- =====================================================================
delete from grupos where nome like '%(EXEMPLO)%';

do $$
declare
  dims text[] := array['Clareza das aulas','Suporte e respostas','Ferramentas','Ambiente do grupo','Segurança no método'];
  k int;
  pos int;
  neg int;
  gid uuid;
  did uuid;
  dids uuid[] := '{}';
  d22 uuid;
  counts int[] := array[120,210,140,48,230,310,240,300,250,150,60,220,330,340,470,350,260,130,320,310,290,382];
  i int;
  t_pun uuid; t_aulas uuid; t_flow uuid; t_link uuid; t_rosto uuid;
  t_pub uuid; t_work uuid; t_multi uuid; t_player uuid;
  p_marina uuid; p_rafael uuid; p_luiza uuid; p_carlos uuid; p_juliana uuid; p_pedro uuid; p_equipe uuid;
begin
  insert into grupos (nome, referencia)
  values ('Chat Alunos (EXEMPLO)', 'DOMINION // Tiktok > Chat Alunos')
  returning id into gid;

  -- 22 dias de outubro de 2026
  for i in 1..22 loop
    insert into dias (grupo_id, data, n_mensagens, n_participantes,
                      clima_positivo, clima_neutro, clima_negativo, nivel, modelo_ia)
    values (gid, date '2026-10-01' + (i - 1), counts[i], 12 + (counts[i] / 12),
            round(counts[i] * 0.46)::int,
            round(counts[i] * 0.30)::int,
            counts[i] - round(counts[i] * 0.46)::int - round(counts[i] * 0.30)::int,
            'intermediario', 'exemplo')
    returning id into did;
    dids := dids || did;
  end loop;
  d22 := dids[22];

  update dias set tempo_resposta_min = 9 + (extract(day from data)::int % 7) where grupo_id = gid;

  update dias set
    n_participantes = 41,
    msgs_por_hora = array[3,2,1,1,0,1,2,3,6,12,20,26,24,34,38,34,52,48,32,28,22,18,14,12],
    frase = 'Empolgação com as aulas novas e o Dominion Flow, abafada por uma onda de punições do TikTok Shop que deixou os alunos inseguros.',
    visao_geral = 'O grupo teve um dia muito movimentado, puxado pelo lançamento das aulas do primeiro módulo. Em contrapartida, vários alunos relataram punições por produto inconsistente no TikTok Shop e a confiança no método caiu.'
  where id = d22;

  -- Temas
  insert into temas (grupo_id, nome) values (gid, 'Punições do TikTok Shop') returning id into t_pun;
  insert into temas (grupo_id, nome) values (gid, 'Aulas novas do primeiro módulo') returning id into t_aulas;
  insert into temas (grupo_id, nome) values (gid, 'Dominion Flow: créditos e acesso') returning id into t_flow;
  insert into temas (grupo_id, nome) values (gid, 'Link na bio e alcance') returning id into t_link;
  insert into temas (grupo_id, nome) values (gid, 'Rosto da modelo muda (Nano Banana)') returning id into t_rosto;
  insert into temas (grupo_id, nome) values (gid, 'Misturar públicos no perfil') returning id into t_pub;
  insert into temas (grupo_id, nome) values (gid, 'Workflows prontos no Flow') returning id into t_work;
  insert into temas (grupo_id, nome) values (gid, 'Multi-contas e contingência') returning id into t_multi;
  insert into temas (grupo_id, nome) values (gid, 'Player do Flow trava') returning id into t_player;

  -- Histórico de punições e de dúvidas do Flow nos dias anteriores
  for i in 12..21 loop
    insert into insights (dia_id, tema_id, tipo, titulo, qtd_alunos, qtd_mencoes, intensidade)
    values (dids[i], t_pun, 'dor', 'Punições do TikTok Shop', (i - 9), (i - 9) * 8, case when i >= 19 then 3 else 2 end);
  end loop;
  for i in 5..21 loop
    insert into insights (dia_id, tema_id, tipo, titulo, qtd_alunos, qtd_mencoes, status, respondida_por)
    values (dids[i], t_flow, 'duvida', 'Dominion Flow: créditos e acesso', 4, 10 + i, 'resolvida', 'equipe');
  end loop;

  -- Insights do dia 22
  insert into insights (dia_id, tema_id, tipo, titulo, descricao, por_que, qtd_alunos, qtd_mencoes, intensidade) values
  (d22, t_pun, 'dor', 'Punições por “produto inconsistente”',
   'Nove alunos contaram que perderam pontos (-15 e -8) ou tiveram vídeos derrubados. Dois relataram recurso negado com dez provas anexadas. Os colegas concluíram que alterar a cor do produto em relação à primeira foto do fornecedor aciona a violação automática.',
   'A plataforma endureceu a checagem automática perto da Black Friday. Importa porque alunos pensam em pausar as postagens e a confiança no método cai.',
   9, 118, 3),
  (d22, t_aulas, 'elogio', 'Aulas novas do primeiro módulo e Dominion Flow',
   'Os alunos elogiaram a profundidade das aulas e os workflows prontos. Um aluno disse gastar cerca de mil créditos para gerar 70 vídeos de 10 segundos.',
   'É o principal motivo de satisfação do dia e vale virar prova social, sem expor nomes.',
   21, 84, 2);

  insert into insights (dia_id, tema_id, tipo, titulo, descricao, qtd_alunos, qtd_mencoes, status, respondida_por, resposta_resumo, sugestao) values
  (d22, t_flow, 'duvida', 'Como funcionam créditos e acesso do Dominion Flow?',
   'Dúvidas sobre créditos, segurança do e-mail e se o acesso é vitalício.', 6, 46, 'resolvida', 'equipe',
   'Mentorados têm condição vitalícia com desconto até 26/10; depois entra assinatura mensal.', null),
  (d22, t_pub, 'duvida', 'Posso misturar roupa masculina e feminina, ou normal e plus size?',
   'Duas alunas perguntaram sobre misturar públicos no mesmo perfil.', 2, 9, 'resolvida', 'equipe',
   'Não. Nichar para um público, porque quem fala com todo mundo não comunica com ninguém.', null),
  (d22, t_link, 'duvida', 'Link na bio reduz o alcance ou pode banir a conta?',
   'Três alunos perguntaram. Um disse que promover algo de fora com a loja ativa pode dar banimento; outro viu perfis grandes fazendo isso.', 3, 17, 'divergente', null,
   'Respostas divergentes entre alunos, sem posição oficial.', 'Definir uma posição oficial e fixar no grupo.'),
  (d22, t_rosto, 'duvida', 'Como manter o rosto da modelo igual no Nano Banana?',
   'Uma aluna gera a modelo no ChatGPT e o rosto muda ao gerar imagens no Nano Banana.', 1, 8, 'aberta', null,
   null, 'Explicar o método de travar a face e indicar a aula atualizada onde isso é mostrado.');

  insert into insights (dia_id, tema_id, tipo, titulo, descricao, qtd_alunos, qtd_mencoes, intensidade) values
  (d22, t_work, 'desejo', 'Mais workflows prontos no Dominion Flow', 'Pedidos por workflows prontos para UGC e provadores.', 4, 12, 1),
  (d22, t_multi, 'dica', 'Usar multi-contas para contingência', 'Recomendação de ter ao menos 2 contas para não depender de uma só.', 5, 29, 1),
  (d22, t_player, 'critica', 'O player do Flow trava ao reproduzir os vídeos', 'Bug intermitente relatado por dois alunos.', 2, 5, 2);

  -- Qualidade do dia 22 (nota = 10 * positivas / (positivas + negativas))
  insert into qualidade_dia (dia_id, dimensao, positivas, neutras, negativas, nota) values
  (d22, 'Clareza das aulas',     21, 6, 4,  round(10.0 * 21 / (21 + 4), 1)),
  (d22, 'Suporte e respostas',   12, 8, 5,  round(10.0 * 12 / (12 + 5), 1)),
  (d22, 'Ferramentas',           19, 7, 6,  round(10.0 * 19 / (19 + 6), 1)),
  (d22, 'Ambiente do grupo',     17, 9, 3,  round(10.0 * 17 / (17 + 3), 1)),
  (d22, 'Segurança no método',   10, 4, 14, round(10.0 * 10 / (10 + 14), 1));

  -- Participantes (nomes fictícios) e atividade do dia 22
  insert into participantes (grupo_id, nome, eh_equipe) values (gid, 'Marina S.', false) returning id into p_marina;
  insert into participantes (grupo_id, nome, eh_equipe) values (gid, 'Rafael T.', false) returning id into p_rafael;
  insert into participantes (grupo_id, nome, eh_equipe) values (gid, 'Luiza P.', false) returning id into p_luiza;
  insert into participantes (grupo_id, nome, eh_equipe) values (gid, 'Carlos A.', false) returning id into p_carlos;
  insert into participantes (grupo_id, nome, eh_equipe) values (gid, 'Juliana B.', false) returning id into p_juliana;
  insert into participantes (grupo_id, nome, eh_equipe) values (gid, 'Pedro H.', false) returning id into p_pedro;
  insert into participantes (grupo_id, nome, eh_equipe) values (gid, 'Equipe da mentoria', true) returning id into p_equipe;

  insert into atividade_dia (dia_id, participante_id, mensagens, respostas_uteis, duvidas) values
  (d22, p_marina, 31, 11, 1),
  (d22, p_rafael, 26, 7, 2),
  (d22, p_luiza, 19, 5, 1),
  (d22, p_carlos, 15, 2, 4),
  (d22, p_juliana, 12, 2, 1),
  (d22, p_pedro, 10, 3, 0),
  (d22, p_equipe, 64, 31, 0);

  -- Ações sugeridas
  insert into acoes (dia_id, texto) values
  (d22, 'Avisar no grupo sobre a regra da primeira foto do anúncio do fornecedor.'),
  (d22, 'Responder a dúvida sobre consistência de rosto no Nano Banana.'),
  (d22, 'Definir uma posição oficial sobre link na bio com a loja ativa.'),
  (d22, 'Agendar um plantão de dúvidas sobre contingência de contas.');

  -- Histórico de qualidade (dias 12 a 21)
  for i in 12..21 loop
    for k in 1..5 loop
      pos := 10 + ((i * k) % 9) + case when k = 5 then 6 - (i - 12) else (i - 12) / 3 end;
      neg := 3 + ((i + k) % 4) + case when k = 5 then (i - 12) / 2 else 0 end;
      insert into qualidade_dia (dia_id, dimensao, positivas, neutras, negativas, nota)
      values (dids[i], dims[k], pos, 5, neg, round(10.0 * pos / (pos + neg), 1));
    end loop;
  end loop;

  -- Histórico de atividade por aluno (dias 15 a 21)
  for i in 15..21 loop
    insert into atividade_dia (dia_id, participante_id, mensagens, respostas_uteis, duvidas) values
    (dids[i], p_marina, 20 + (i % 5) * 3, 6 + (i % 4), i % 2),
    (dids[i], p_rafael, 17 + (i % 4) * 3, 4 + (i % 3), 1 + i % 2),
    (dids[i], p_luiza, 12 + (i % 6) * 2, 3 + (i % 3), i % 2),
    (dids[i], p_carlos, 10 + (i % 5), 1 + (i % 2), 2 + i % 3),
    (dids[i], p_juliana, 8 + (i % 4) * 2, 1 + (i % 3), i % 2),
    (dids[i], p_pedro, 5 + (i % 6) * 2, i % 4, 0),
    (dids[i], p_equipe, 40 + (i % 5) * 5, 18 + (i % 4) * 3, 0);
  end loop;

  -- Histórico de dúvidas em aberto, desejos e elogios
  for i in 17..21 loop
    insert into insights (dia_id, tema_id, tipo, titulo, descricao, qtd_alunos, qtd_mencoes, status, resposta_resumo, sugestao)
    values (dids[i], t_link, 'duvida', 'Link na bio reduz o alcance ou pode banir a conta?', null,
            2 + (i % 3), 8 + i, 'divergente', 'Respostas divergentes entre alunos, sem posição oficial.',
            'Definir uma posição oficial e fixar no grupo.');
  end loop;
  for i in 20..21 loop
    insert into insights (dia_id, tema_id, tipo, titulo, descricao, qtd_alunos, qtd_mencoes, status, sugestao)
    values (dids[i], t_rosto, 'duvida', 'Como manter o rosto da modelo igual no Nano Banana?', null,
            1 + (i % 2), 3 + i % 4, 'aberta', 'Explicar o método de travar a face e indicar a aula atualizada.');
  end loop;
  for i in 14..21 loop
    insert into insights (dia_id, tema_id, tipo, titulo, qtd_alunos, qtd_mencoes, intensidade)
    values (dids[i], t_work, 'desejo', 'Mais workflows prontos no Dominion Flow', 2 + (i % 4), 6 + i % 7, 1);
  end loop;
  for i in 15..21 loop
    insert into insights (dia_id, tema_id, tipo, titulo, qtd_alunos, qtd_mencoes, intensidade)
    values (dids[i], t_aulas, 'elogio', 'Aulas novas do primeiro módulo', 8 + (i % 5), 30 + (i % 6) * 9, 2);
  end loop;
  for i in 16..21 loop
    insert into insights (dia_id, tema_id, tipo, titulo, qtd_alunos, qtd_mencoes, intensidade)
    values (dids[i], t_multi, 'dica', 'Usar multi-contas para contingência', 3 + (i % 3), 12 + (i % 5) * 4, 1);
  end loop;

  -- Relatórios (exemplo): semana de 12 a 18 e mês de outubro (parcial)
  insert into relatorios (grupo_id, tipo, inicio, fim, parcial, dias_com_dados, frase, conteudo, modelo_ia) values
  (gid, 'semanal', date '2026-10-12', date '2026-10-18', false, 7,
   'Semana de maior movimento do mês, puxada pelo lançamento das aulas do primeiro módulo. A satisfação subiu, mas as punições do TikTok Shop viraram a principal preocupação dos alunos.',
   $j$ {
     "assuntos": [
       {"titulo": "Punições do TikTok Shop", "pct": 31, "tipo": "dor"},
       {"titulo": "Aulas novas e workflows prontos", "pct": 24, "tipo": "elogio"},
       {"titulo": "Dominion Flow: créditos e acesso", "pct": 17, "tipo": "duvida"},
       {"titulo": "Multi-contas e contingência", "pct": 12, "tipo": "dica"},
       {"titulo": "Link na bio e alcance", "pct": 7, "tipo": "duvida"}
     ],
     "mudancas": [
       {"tipo": "subiu", "texto": "Punições do TikTok Shop: de 3 para 11 dias com menção."},
       {"tipo": "subiu", "texto": "Elogios às aulas novas, que quase não existiam na semana anterior."},
       {"tipo": "novo", "texto": "Rosto da modelo muda ao gerar imagens no Nano Banana."},
       {"tipo": "caiu", "texto": "Dúvidas básicas de cadastro e primeira postagem."}
     ],
     "perguntas": [
       {"texto": "Link na bio reduz o alcance ou bane a conta?", "vezes": 9},
       {"texto": "Posso misturar públicos ou tamanhos no mesmo perfil?", "vezes": 7},
       {"texto": "Como usar música normal sem restrição comercial?", "vezes": 5},
       {"texto": "Como manter o rosto da modelo no Nano Banana?", "vezes": 4},
       {"texto": "O acesso ao Flow é vitalício?", "vezes": 3}
     ],
     "desejos": [
       {"texto": "Mais workflows prontos no Dominion Flow.", "alunos": 18},
       {"texto": "Aula ou plantão sobre recuperação de contas.", "alunos": 11},
       {"texto": "Barra de progresso e prioridade de fila nos vídeos.", "alunos": 7}
     ],
     "recomendacoes": [
       {"titulo": "Responder oficialmente sobre as punições.", "texto": "Explicar a regra da primeira foto e mostrar como montar contas de contingência, antes que a insegurança vire desistência."},
       {"titulo": "Fechar a pergunta mais repetida.", "texto": "Definir e fixar a posição sobre link na bio com a loja ativa."},
       {"titulo": "Criar conteúdo a partir das dúvidas.", "texto": "Consistência de rosto no Nano Banana e recuperação de contas têm demanda clara."}
     ]
   } $j$::jsonb, 'exemplo'),
  (gid, 'mensal', date '2026-10-01', date '2026-10-31', true, 22,
   'Outubro começou devagar, ganhou força com as aulas novas do primeiro módulo e segue com a satisfação alta, mas a confiança no método está ameaçada pelas punições do TikTok Shop.',
   $j$ {
     "assuntos": [
       {"titulo": "Punições do TikTok Shop", "pct": 28, "tipo": "dor"},
       {"titulo": "Aulas novas e workflows prontos", "pct": 22, "tipo": "elogio"},
       {"titulo": "Dominion Flow: créditos e acesso", "pct": 18, "tipo": "duvida"},
       {"titulo": "Multi-contas e contingência", "pct": 11, "tipo": "dica"},
       {"titulo": "Link na bio e alcance", "pct": 8, "tipo": "duvida"}
     ],
     "marcos": [
       {"data": "15 out", "texto": "Aulas do primeiro módulo liberadas e maior dia do mês."},
       {"data": "17 out", "texto": "Dominion Flow vira assunto central: dúvidas de crédito e acesso."},
       {"data": "20 out", "texto": "Primeiros relatos de punição por produto inconsistente."},
       {"data": "22 out", "texto": "Onda de punições domina o grupo e a segurança no método cai."}
     ],
     "perguntas": [
       {"texto": "Link na bio reduz o alcance ou bane a conta?", "vezes": 14},
       {"texto": "Como funcionam créditos e acesso do Dominion Flow?", "vezes": 12},
       {"texto": "Posso misturar públicos ou tamanhos no perfil?", "vezes": 10},
       {"texto": "Quanto tempo esperar para validar um produto?", "vezes": 8}
     ],
     "desejos": [
       {"texto": "Mais workflows prontos no Flow.", "alunos": 31},
       {"texto": "Aula de recuperação de contas.", "alunos": 19},
       {"texto": "Melhorias de usabilidade no Flow.", "alunos": 9}
     ],
     "recomendacoes": [
       {"titulo": "Estabilizar a confiança.", "texto": "Transformar as punições em uma aula curta e um guia de contingência."},
       {"titulo": "Transformar dúvidas repetidas em conteúdo fixo.", "texto": "Link na bio e créditos do Flow aparecem o mês inteiro."},
       {"titulo": "Priorizar pedidos de ferramenta.", "texto": "Workflows prontos têm a maior demanda e a melhor chance de elogio."}
     ]
   } $j$::jsonb, 'exemplo');
end
$$;
