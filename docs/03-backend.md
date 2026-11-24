# Serena Agenda · Backend / BaaS (Aula 03)

> Exercício: configurar o back-end do MVP com Supabase, a partir do [documento de requisitos](../README.md) e do [protótipo da Aula 02](02-ux-ui.md).
> Schema em [`supabase/schema.sql`](../supabase/schema.sql), seed em [`supabase/seed.sql`](../supabase/seed.sql), SDK em [`lib/supabase.ts`](../lib/supabase.ts).

## Sumário

1. [Modelagem das entidades](#1--modelagem-das-entidades)
2. [Schema SQL gerado com IA](#2--schema-sql-gerado-com-ia)
3. [Decisão de RLS (sem login)](#3--decisão-de-rls-sem-login)
4. [RF05 no banco: defesa em profundidade](#4--rf05-no-banco-defesa-em-profundidade)
5. [Passo a passo: criar o projeto no Supabase](#5--passo-a-passo-criar-o-projeto-no-supabase)
6. [Integrar o SDK e testar o CRUD](#6--integrar-o-sdk-e-testar-o-crud)
7. [Checklist do entregável](#7--checklist-do-entregável)
8. [Apêndice: prompt CTQF usado](#apêndice--prompt-ctqf-usado)

---

## 1 · Modelagem das entidades

As duas entidades já existiam no protótipo navegável (`prototipo/js/app.js`, função `seed()`), então a modelagem partiu dos dados reais usados ali, não de uma lista genérica:

| Entidade | Atributos | Relacionamento | Requisitos |
|---|---|---|---|
| `servicos` | `id`, `nome`, `duracao_min`, `preco` | — | RF01, RF02, RF03 |
| `agendamentos` | `id`, `cliente_nome`, `cliente_telefone`, `servico_id`, `data`, `hora`, `status` | `servico_id` → `servicos.id` (N:1) | RF04, RF05, RF06, RF07 |

**Decisão:** `servico_id` usa `on delete set null` em vez de `on delete cascade` ou bloquear a exclusão. Isso reproduz o comportamento já validado no teste heurístico da Aula 02 (tela 4): excluir um serviço em uso **não apaga o histórico de agendamentos**, só o deixa com serviço "removido" — mesmo texto que já aparece no protótipo (`s ? s.nome : 'Serviço removido'`).

---

## 2 · Schema SQL gerado com IA

O schema completo está em [`supabase/schema.sql`](../supabase/schema.sql). Resumo das restrições, todas rastreáveis a um RF/RNF do README:

| Constraint | Requisito de origem |
|---|---|
| `nome` com `char_length >= 3` | AC1 da US-01 |
| `duracao_min between 10 and 480` | AC1/AC2 da US-01 |
| `preco > 0` | AC1 da US-01 |
| `cliente_telefone` com 10 ou 11 dígitos | AC1 da US-02 |
| `status in ('ativo','cancelado','noshow')` | RF07 / US-05 |

## 3 · Decisão de RLS (sem login)

O MVP **não tem login** (ver README § 07 "Fora de escopo" e RNF06). Isso muda o que RLS pode fazer aqui:

- RLS **ligado** nas duas tabelas, porque o padrão do Supabase é bloquear tudo quando RLS está ativo e não existe policy — então mesmo "liberado para todos" precisa de policy explícita, não é a ausência de RLS.
- As policies usam `using (true)` / `with check (true)`: liberam a chave **anon** (pública) para `select`, `insert`, `update` e `delete`. Não existe conceito de "dono da linha" porque não existe usuário autenticado.
- **Isso não é um descuido, é o risco já aceito no README** (RNF06: "mitiga a ausência de login"): qualquer pessoa com o link e a anon key pode ler/escrever. A mitigação do MVP é não divulgar a anon key publicamente além do necessário para o front, `noindex` nas páginas, e esse ponto fica registrado como pendência para uma v2 com login.

> Se o professor pedir RLS "restritiva" em vez de pública: a mudança é trocar as quatro policies de cada tabela por uma baseada em `auth.uid()`, o que exige adicionar login (Supabase Auth) — fora do escopo combinado no README.

## 4 · RF05 no banco: defesa em profundidade

O protótipo da Aula 02 já impede conflito de horário no front (`conflito()` em `app.js`). O slide da Aula 04 pergunta diretamente: *"você duplicou validação de formato nos dois lados sem necessidade, ou deixou integridade para o banco?"* — a resposta aqui é que o **front valida formato e UX** (resposta rápida, sugestão de horários), e o **banco valida a regra de negócio** (RF05 é MUST) via trigger (`checar_conflito_agendamento`), para o caso de duas escritas simultâneas ou qualquer chamada direta à API que não passe pela UI. Não é duplicação de formato — é a mesma regra de negócio em duas camadas com responsabilidades diferentes.

---

## 5 · Passo a passo: criar o projeto no Supabase

Esta parte só você consegue fazer (é uma conta pessoal):

1. Acesse [supabase.com](https://supabase.com), crie conta (GitHub login é o mais rápido) e **New project**.
2. Escolha uma senha de banco forte e salve-a (é o `DATABASE_URL`, não é a anon key).
3. Espere o projeto provisionar (1–2 min). Abra **SQL Editor** → **New query**.
4. Cole o conteúdo de `supabase/schema.sql`, rode (▶ Run). Depois cole `supabase/seed.sql` e rode também.
5. Confira em **Table Editor**: devem existir `servicos` (3 linhas) e `agendamentos` (0 linhas).
6. Em **Project Settings → API**, copie **Project URL** e a chave **anon public**.

## 6 · Integrar o SDK e testar o CRUD

```bash
npm install
cp .env.example .env
# edite .env com a Project URL e a anon key copiadas no passo 6 acima
npm run test:crud
```

O script (`scripts/test-crud.ts`) insere 3 serviços de teste, lista, atualiza 1 e exclui 1 — exatamente a sequência pedida no entregável. Confirme o resultado em **Table Editor**: devem sobrar os 3 serviços do seed mais 2 de teste (um deles com o preço atualizado).

> Rodado em produção (projeto `qnrvpxiagyqmygvgfwnk`) em 2026-11-24: os 5 registros (3 seed + 2 teste) foram confirmados no Table Editor. Os 2 registros de teste ("Teste CRUD 1/2") foram removidos depois, para o catálogo não ficar com dados fictícios quando a Aula 04 passar a listar os serviços de verdade.

## 7 · Checklist do entregável

- [x] Schema SQL documentado (`supabase/schema.sql`)
- [x] Projeto Supabase criado, com RLS habilitado (projeto `qnrvpxiagyqmygvgfwnk`)
- [x] 2 tabelas com policies criadas (incluídas no schema)
- [x] SDK integrado ao front (`lib/supabase.ts`)
- [x] Variáveis de ambiente configuradas (`.env` local, fora do git)
- [x] Operações CRUD testadas do front (`npm run test:crud`, rodado com sucesso: insert 3, list, update 1, delete 1)
- [x] 3 serviços inseridos no banco (`supabase/seed.sql`)

**Submissão (conforme o slide):** link do repositório + URL do projeto Supabase.

---

## Apêndice · Prompt CTQF usado

```
# CONTEXTO
MVP "Serena Agenda": agendamento de serviços de salão, mobile-first, sem login.
Entidades já usadas no protótipo (prototipo/js/app.js): servicos (nome, duracao, preco)
e agendamentos (cliente, telefone, servicoId, data, hora, status: ativo/cancelado/noshow).
Requisitos: RF01-RF09 e RNF05/RNF06 do README.md.

# TAREFA
Gere o schema SQL (PostgreSQL/Supabase) para as duas tabelas, com constraints que
cheguem nos critérios de aceite das histórias US-01 e US-02, mais RLS habilitado
com policies (documentar a decisão de acesso público, já que o MVP não tem login)
e um mecanismo de banco para impedir conflito de horário (RF05), como defesa em
profundidade além da validação já feita no front.

# QUEM
Você é um engenheiro de backend sênior especialista em PostgreSQL e Supabase (RLS, triggers).

# FORMATO
SQL comentado, pronto para colar no SQL Editor do Supabase, com uma tabela separada
explicando cada constraint e sua origem (RF/RNF/AC).
```

> Revisão humana: o trigger de conflito foi testado mentalmente contra os casos do teste heurístico da Aula 02 (agendamentos consecutivos são permitidos, serviço excluído usa duração padrão de 30 min) antes de ser aceito — não foi copiado sem checar contra o comportamento já validado no protótipo.
