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
-- 02b · Tabela feriados (v2 — revisão de design pós-Aula 04, docs/04-frontend.md § 5)
-- ============================================================
-- Dá à proprietária controle de longo prazo sobre dias fechados (Natal, Ano
-- Novo etc.) sem precisar de um dev para mudar código e fazer novo deploy:
-- basta adicionar/remover uma linha nesta tabela pelo Table Editor do Supabase.
-- Datas fixas por ano (ex.: 25/12 de cada ano é uma linha própria) — é uma
-- simplificação aceita: não há cálculo de feriado móvel (Páscoa, Carnaval).
create table if not exists feriados (
  data   date primary key,
  motivo text not null check (char_length(motivo) >= 3)
);

comment on table feriados is 'v2: dias em que o salão não abre (datas específicas, ex.: Natal). Gerenciado pela proprietária no Table Editor — ver docs/04-frontend.md § 5.';

-- ============================================================
-- 02c · Tabela expediente_semana (v2 — revisão de design pós-Aula 04, docs/04-frontend.md § 5)
-- ============================================================
-- Substitui o par fixo HORA_ABRE/HORA_FECHA (8h-20h todo dia) por um
-- expediente configurável por dia da semana, com pausa (almoço) opcional —
-- a proprietária ajusta pelo Table Editor, sem depender de um dev.
-- dia_semana: 0 = domingo ... 6 = sábado (igual a extract(dow from data)).
create table if not exists expediente_semana (
  dia_semana   integer primary key check (dia_semana between 0 and 6),
  fechado      boolean not null default false,
  hora_abre    time,
  hora_fecha   time,
  pausa_inicio time,
  pausa_fim    time,
  check (fechado or (hora_abre is not null and hora_fecha is not null and hora_abre < hora_fecha)),
  check ((pausa_inicio is null) = (pausa_fim is null)),
  check (
    pausa_inicio is null
    or (hora_abre is not null and hora_fecha is not null
        and pausa_inicio >= hora_abre and pausa_fim <= hora_fecha and pausa_inicio < pausa_fim)
  )
);

comment on table expediente_semana is 'v2: expediente e pausa (almoço) por dia da semana. Gerenciado pela proprietária no Table Editor — ver docs/04-frontend.md § 5.';

-- ============================================================
-- 02d · Tabela configuracao (Aula 05 — limite de antecedência)
-- ============================================================
-- Linha única (id = 1). antecedencia_max_dias = até quantos dias à frente a
-- proprietária aceita marcar. Padrão 30; ela muda na tela Horários.
create table if not exists configuracao (
  id                   integer primary key default 1 check (id = 1),
  antecedencia_max_dias integer not null default 30 check (antecedencia_max_dias between 1 and 365)
);

insert into configuracao (id) values (1) on conflict (id) do nothing;

comment on table configuracao is 'Aula 05: configuração única do salão. antecedencia_max_dias limita quão no futuro um agendamento pode ser criado.';

-- ============================================================
-- 03 · RF05 — Impedir conflito de horário e expediente inválido (defesa em profundidade)
-- ============================================================
-- O front (Aula 02/04) já valida isso antes de enviar. Este trigger garante
-- a mesma regra no banco, para o caso de duas requisições simultâneas ou de
-- qualquer cliente que grave direto via SDK/API (ver docs/03-backend.md, item 4
-- e docs/04-frontend.md § 5, revisão de design "calendário de funcionamento
-- idealizado": feriado específico → expediente do dia da semana → fora do
-- horário → pausa de almoço → conflito com outro agendamento, nessa ordem).
create or replace function checar_conflito_agendamento()
returns trigger
language plpgsql
as $$
declare
  duracao_novo   integer;
  fim_novo       time;
  motivo_feriado text;
  exp            expediente_semana%rowtype;
  agora_local    timestamp := now() at time zone 'America/Sao_Paulo';
  limite_dias    integer;
begin
  if new.status <> 'ativo' then
    return new;
  end if;

  -- BUG-05 (Aula 05) + limite de antecedência: só na CRIAÇÃO. Em update (cancelar,
  -- "não compareceu", desfazer) o agendamento pode, legitimamente, já estar no passado.
  if tg_op = 'INSERT' then
    if (new.data + new.hora) < agora_local then
      raise exception 'Não é possível agendar em horário que já passou.'
        using errcode = 'P0001';
    end if;

    select antecedencia_max_dias into limite_dias from configuracao where id = 1;
    limite_dias := coalesce(limite_dias, 30);
    if new.data > agora_local::date + limite_dias then
      raise exception 'Só é possível agendar até % dias à frente.', limite_dias
        using errcode = 'P0001';
    end if;
  end if;

  select motivo into motivo_feriado from feriados where data = new.data;
  if motivo_feriado is not null then
    raise exception 'O salão não abre em % (%).', new.data, motivo_feriado
      using errcode = 'P0001';
  end if;

  select * into exp from expediente_semana where dia_semana = extract(dow from new.data);
  if exp is null or exp.fechado then
    raise exception 'O salão não abre nesse dia da semana (%).', new.data
      using errcode = 'P0001';
  end if;

  select duracao_min into duracao_novo from servicos where id = new.servico_id;
  if duracao_novo is null then
    duracao_novo := 30; -- mesma duração padrão usada no protótipo quando o serviço foi removido
  end if;
  fim_novo := new.hora + make_interval(mins => duracao_novo);

  if new.hora < exp.hora_abre or fim_novo > exp.hora_fecha then
    raise exception 'Fora do horário de funcionamento (% às %).', exp.hora_abre, exp.hora_fecha
      using errcode = 'P0001';
  end if;

  if exp.pausa_inicio is not null and new.hora < exp.pausa_fim and fim_novo > exp.pausa_inicio then
    raise exception 'Esse horário cai no intervalo de almoço (% às %).', exp.pausa_inicio, exp.pausa_fim
      using errcode = 'P0001';
  end if;

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
alter table feriados enable row level security;
alter table expediente_semana enable row level security;
alter table configuracao enable row level security;

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

drop policy if exists feriados_select_publico on feriados;
create policy feriados_select_publico on feriados for select using (true);

drop policy if exists feriados_insert_publico on feriados;
create policy feriados_insert_publico on feriados for insert with check (true);

drop policy if exists feriados_delete_publico on feriados;
create policy feriados_delete_publico on feriados for delete using (true);

drop policy if exists expediente_select_publico on expediente_semana;
create policy expediente_select_publico on expediente_semana for select using (true);

drop policy if exists expediente_update_publico on expediente_semana;
create policy expediente_update_publico on expediente_semana for update using (true) with check (true);

-- Insert também liberado (e não só update): as 7 linhas normalmente vêm do
-- seed.sql, mas a tela Horários do front sabe se recriar sozinha se alguém
-- rodou o schema sem o seed (ver HorariosPage.tsx, botão "Criar expediente padrão").
drop policy if exists expediente_insert_publico on expediente_semana;
create policy expediente_insert_publico on expediente_semana for insert with check (true);

drop policy if exists configuracao_select_publico on configuracao;
create policy configuracao_select_publico on configuracao for select using (true);

drop policy if exists configuracao_insert_publico on configuracao;
create policy configuracao_insert_publico on configuracao for insert with check (true);

drop policy if exists configuracao_update_publico on configuracao;
create policy configuracao_update_publico on configuracao for update using (true) with check (true);
