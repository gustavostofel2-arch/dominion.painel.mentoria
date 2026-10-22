-- Migração 001: adiciona o tempo de resposta da equipe em "dias".
-- Rode UMA vez no SQL Editor do Supabase (quem já rodou o schema.sql antes).
alter table dias add column if not exists tempo_resposta_min int;
