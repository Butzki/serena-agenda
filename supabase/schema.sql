-- Serena Agenda · Schema (Aula 03 · Backend/BaaS)
-- Rode este arquivo inteiro no SQL Editor do Supabase (projeto novo, banco vazio).
-- Modelo extraído do protótipo validado na Aula 02 (prototipo/js/app.js) e do
-- documento de requisitos (README.md: RF01-RF09, RNF05, RNF06).

create extension if not exists pgcrypto;

-- ============================================================
-- 01 · Tabela servicos (RF01, RF02, RF03)
-- ============================================================
create table if not exists servicos (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null check (char_length(nome) >= 3),
  duracao_min integer not null check (duracao_min between 10 and 480),
  preco       numeric(10,2) not null check (preco > 0),
  criado_em   timestamptz not null default now()
);

comment on table servicos is 'RF01-RF03: catálogo de serviços do salão (nome, duração em minutos, preço em R$).';

-- ============================================================
-- 02 · Tabela agendamentos (RF04, RF05, RF06, RF07)
-- ============================================================
create table if not exists agendamentos (
  id               uuid primary key default gen_random_uuid(),
  cliente_nome     text not null check (char_length(cliente_nome) >= 3),
  cliente_telefone text not null check (char_length(regexp_replace(cliente_telefone, '\D', '', 'g')) between 10 and 11),
  servico_id       uuid references servicos(id) on delete set null,
  data             date not null,
  hora             time not null,
  status           text not null default 'ativo' check (status in ('ativo', 'cancelado', 'noshow')),
  criado_em        timestamptz not null default now()
);

comment on table agendamentos is 'RF04-RF07: agendamentos vinculados a um serviço. servico_id vira NULL se o serviço for excluído (ver US-05 / tela 4 do protótipo: "Serviço removido").';

create index if not exists idx_agendamentos_data on agendamentos (data);
create index if not exists idx_agendamentos_servico on agendamentos (servico_id);

-- ============================================================
-- 03 · RF05 — Impedir conflito de horário e expediente inválido (defesa em profundidade)
-- ============================================================
-- O front (Aula 02/04) já valida isso antes de enviar. Este trigger garante
-- a mesma regra no banco, para o caso de duas requisições simultâneas ou de
-- qualquer cliente que grave direto via SDK/API (ver docs/03-backend.md, item 4
-- e docs/04-frontend.md, revisão de design "fechado aos domingos").
--
-- Suposição de negócio (documentada, não confirmada com a proprietária):
-- domingo (dow = 0) é fechado. Ajuste o "0" abaixo se o dia certo for outro.
create or replace function checar_conflito_agendamento()
returns trigger
language plpgsql
as $$
declare
  duracao_novo integer;
  fim_novo     time;
begin
  if new.status <> 'ativo' then
    return new;
  end if;

  if extract(dow from new.data) = 0 then
    raise exception 'O salão não abre aos domingos (%).', new.data
      using errcode = 'P0001';
  end if;

  select duracao_min into duracao_novo from servicos where id = new.servico_id;
  if duracao_novo is null then
    duracao_novo := 30; -- mesma duração padrão usada no protótipo quando o serviço foi removido
  end if;
  fim_novo := new.hora + make_interval(mins => duracao_novo);

  if exists (
    select 1
    from agendamentos a
    left join servicos s on s.id = a.servico_id
    where a.data = new.data
      and a.status = 'ativo'
      and a.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
      and new.hora < (a.hora + make_interval(mins => coalesce(s.duracao_min, 30)))
      and fim_novo > a.hora
  ) then
    raise exception 'Conflito de horário em %, %: já existe um agendamento ativo nesse intervalo.', new.data, new.hora
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_checar_conflito on agendamentos;
create trigger trg_checar_conflito
  before insert or update on agendamentos
  for each row execute function checar_conflito_agendamento();

-- ============================================================
-- 04 · Row Level Security
-- ============================================================
-- Decisão de escopo (ver README.md § 07 "Fora de escopo" e RNF06):
-- o MVP não tem login. O acesso é feito com a chave "anon" do Supabase,
-- então o RLS aqui não restringe por usuário (não existe usuário) — ele
-- existe para que o banco NUNCA fique acessível sem policy nenhuma
-- (comportamento padrão do Supabase é bloquear tudo com RLS ligado e
-- sem policy). O risco de qualquer pessoa com a anon key ler/escrever
-- está aceito e documentado no README, não é um descuido.

alter table servicos enable row level security;
alter table agendamentos enable row level security;

drop policy if exists servicos_select_publico on servicos;
create policy servicos_select_publico on servicos for select using (true);

drop policy if exists servicos_insert_publico on servicos;
create policy servicos_insert_publico on servicos for insert with check (true);

drop policy if exists servicos_update_publico on servicos;
create policy servicos_update_publico on servicos for update using (true) with check (true);

drop policy if exists servicos_delete_publico on servicos;
create policy servicos_delete_publico on servicos for delete using (true);

drop policy if exists agendamentos_select_publico on agendamentos;
create policy agendamentos_select_publico on agendamentos for select using (true);

drop policy if exists agendamentos_insert_publico on agendamentos;
create policy agendamentos_insert_publico on agendamentos for insert with check (true);

drop policy if exists agendamentos_update_publico on agendamentos;
create policy agendamentos_update_publico on agendamentos for update using (true) with check (true);

drop policy if exists agendamentos_delete_publico on agendamentos;
create policy agendamentos_delete_publico on agendamentos for delete using (true);
