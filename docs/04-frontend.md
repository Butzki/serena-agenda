# Serena Agenda · Frontend React + Tailwind (Aula 04)

> Exercício: construir as 4 telas consumindo o back-end real (Supabase, Aula 03), em `frontend/`.
> Protótipo estático da Aula 02 (`prototipo/`) continua no repo como registro histórico; as telas de verdade agora vivem em `frontend/src`.

## Sumário

1. [O que foi construído](#1--o-que-foi-construído)
2. [Como rodar e testar localmente](#2--como-rodar-e-testar-localmente)
3. [Estados de UI por tela](#3--estados-de-ui-por-tela)
4. [Validação: front vs. banco](#4--validação-front-vs-banco)
5. [Revisão de design: problemas encontrados](#5--revisão-de-design-problemas-encontrados)
6. [Deploy](#6--deploy)
7. [Checklist do entregável](#7--checklist-do-entregável)

---

## 1 · O que foi construído

**Stack:** Vite + React 18 + TypeScript + Tailwind, `@supabase/supabase-js`, `react-router-dom`.

**Componentes base** (`frontend/src/components/ui/`): `Button`, `Input` (também cobre `<select>`), `Card`, `Badge` — todos usando os mesmos tokens visuais já validados e com contraste calculado na Aula 02 (`frontend/src/styles/tokens.css`, cópia de `prototipo/css/tokens.css`), referenciados via `var(--...)` dentro de classes Tailwind (`bg-[var(--cor-primaria)]`), não valores novos.

**4 telas** (`frontend/src/pages/`), mapeadas 1:1 nas rotas — o mínimo pedido pelo slide:

| Tela | Rota | Arquivo |
|---|---|---|
| Agenda do dia | `/agenda?data=` | `AgendaPage.tsx` |
| Novo agendamento | `/agenda/novo?data=&hora=` | `NovoAgendamentoPage.tsx` |
| Lista de serviços | `/servicos` | `ServicosPage.tsx` |
| Cadastro / edição de serviço | `/servicos/novo`, `/servicos/:id/editar` | `NovoServicoPage.tsx` |

**+1 tela, além do pedido:** `Horários` (`/horarios`, `HorariosPage.tsx`) — editar o expediente de cada dia da semana, a pausa de almoço e a lista de feriados. Existe porque a revisão de design da seção 5 criou as tabelas `expediente_semana`/`feriados`, e deixar a proprietária dependente do Table Editor do Supabase para ajustá-las não fazia sentido como produto; o app mesmo precisava dar esse controle.

Toda a casca comum (cabeçalho, toast, navegação inferior) está em `components/Layout.tsx`; o diálogo de confirmação (cancelar/excluir) em `components/ConfirmDialog.tsx` — ambos portados do HTML/CSS/JS do protótipo, não redesenhados do zero.

**Como foi produzido:** construído com apoio do Claude Code (agente de codificação), lendo o protótipo (`prototipo/js/app.js`) e os documentos das Aulas 01-03 como fonte de verdade para regras de negócio, nomes de campo e comportamento — não a partir de um prompt avulso de chat. A revisão humana aconteceu em duas rodadas: build de produção (`npm run build`, sem erros de tipo) e uma sessão de revisão de design (seção 5) que encontrou e corrigiu uma lacuna real antes de fechar a etapa.

## 2 · Como rodar e testar localmente

**Se o seu banco já existia antes da revisão de design (seção 5), atualize-o primeiro:** no SQL Editor do Supabase, cole e rode o `supabase/schema.sql` inteiro de novo (é idempotente, `create or replace`/`drop...if exists` em tudo). Depois rode **só o bloco novo** do `supabase/seed.sql` — o `insert into feriados` e o `insert into expediente_semana` (ambos com `on conflict do nothing`) — **não** rode o `insert into servicos` de novo, ele duplicaria os serviços (não tem proteção contra duplicata, de propósito, porque nomes de serviço podem repetir legitimamente).

> **Esqueceu de rodar o bloco do `expediente_semana` no seed?** A tela **Horários** detecta a tabela vazia e mostra um botão "Criar expediente padrão" que resolve pelo próprio app, sem precisar voltar ao SQL Editor.

```bash
cd frontend
npm install
cp .env.local.example .env.local   # cole a mesma URL e publishable key da etapa 03
npm run dev
```

Abra a URL impressa no terminal (normalmente `http://localhost:5173`). Teste:
- Criar, editar e excluir um serviço.
- Criar um agendamento, incluindo um que **conflite** de propósito (veja a sugestão de horários alternativos).
- Cancelar e marcar "não compareceu" na agenda.
- Redimensionar a janela (ou DevTools → modo responsivo) em **375px, 768px e 1280px** — é o entregável de responsividade da aula; isso precisa ser conferido visualmente por você, a IA não tem acesso ao navegador nesta sessão.

## 3 · Estados de UI por tela

| Tela | Loading | Empty | Success | Error |
|---|---|---|---|---|
| Agenda | "Carregando agenda…" | "Nenhum agendamento neste dia" (dia livre) | Lista de horários livres/ocupados | Card com motivo do erro + "Tentar de novo" |
| Novo agendamento | "Carregando serviços…" | "Nenhum serviço cadastrado" (bloqueia o formulário e leva para cadastrar um) | Formulário | Alerta de conflito (`role="alert"`) e erro de salvamento |
| Serviços | "Carregando serviços…" | "Nenhum serviço cadastrado" | Lista de cartões | Card com motivo do erro + "Tentar de novo" |
| Cadastro/edição | "Carregando serviço…" (modo edição) | — (não se aplica a um formulário) | Formulário preenchido ou em branco | "Serviço não encontrado" / erro de salvar |
| Horários | "Carregando horários…" | "Nenhum feriado cadastrado" (lista de feriados) | 7 dias editáveis + lista de feriados | Card com motivo do erro + "Tentar de novo" |

## 4 · Validação: front vs. banco

Pergunta do slide da Aula 04: *"você validou no front apenas formato (UX) e deixou integridade para o banco? Ou duplicou validação sem necessidade?"*

- **Formato** (tamanho mínimo de nome, dígitos do telefone) é validado **só no front**, para dar feedback imediato — o banco também tem `check constraints` equivalentes (`supabase/schema.sql`), mas eles existem como rede de segurança, não como segunda fonte de mensagem de erro ao usuário.
- **Regra de negócio** (RF05 conflito de horário; fechado por domingo/feriado; fora do expediente do dia; dentro da pausa de almoço) é checada **nas duas camadas de propósito, com a mesma função de decisão dos dois lados**: o front chama `motivoConflito()` (`lib/horarios.ts`) antes de salvar — resposta rápida, com sugestão de horários alternativos já filtrados pelo próprio expediente — e o trigger do banco (`checar_conflito_agendamento`) decide de verdade, na mesma ordem de prioridade (feriado → dia da semana → expediente → pausa → conflito com outro agendamento). Se as duas camadas discordarem (corrida entre duas abas, ou alguém chamando a API direto), o erro do banco é capturado e reaproveitado na mesma UI de alerta (`NovoAgendamentoPage.tsx`).

## 5 · Revisão de design: problemas encontrados e corrigidos (v2)

Depois de montar as 4 telas, revisei o projeto atrás de lacunas da **mesma categoria** do problema que você levantou ("o sistema assume um calendário de funcionamento idealizado, sem fechamento, sem pausa, sem desfazer erro de operação"). Cinco achados; quatro foram corrigidos nesta v2, incorporando o que antes estava listado como "pendência":

| # | Problema | Onde | Categoria | Status |
|---|---|---|---|---|
| 1 | Expediente fixo 8h–20h **todos os dias**, inclusive domingo, sem nenhuma exceção possível | `lib/horarios.ts` (herdado do protótipo) | Calendário de funcionamento idealizado | **Corrigido**: tabela `expediente_semana` (um registro por dia da semana, com `fechado`, `hora_abre`, `hora_fecha`) substitui a constante fixa — editável pela proprietária direto na tela **Horários** do app (`/horarios`), sem precisar de um dev/deploy novo nem acesso ao Supabase |
| 2 | Feriados (Natal etc.) não eram bloqueados | mesma lacuna, mais ampla | Calendário de funcionamento idealizado | **Corrigido**: tabela `feriados` (data + motivo); checada no front e no trigger antes de qualquer outra regra. Limite aceito: datas fixas por ano, sem cálculo de feriado móvel (Páscoa, Carnaval) — a proprietária adiciona os próximos ela mesma |
| 3 | Sem intervalo de almoço/pausa no meio do expediente | mesma lacuna, mesma raiz | Calendário de funcionamento idealizado | **Corrigido** (infraestrutura pronta, sem horário pré-definido): `pausa_inicio`/`pausa_fim` opcionais em `expediente_semana`, aparecem como bloco "Pausa (almoço)" na agenda e contam como conflito ao agendar — mas ficam `null` por padrão, porque não há confirmação real da proprietária sobre o horário, e inventar um seria o mesmo erro que o checklist de validação humana (README) já pede para evitar |
| 4 | "Não compareceu" não tinha desfazer | já registrado em `docs/02-ux-ui.md` § 6.2 (H3, sev. 2) | Reversibilidade de ação | **Corrigido**: botão "Desfazer" na `AgendaPage` quando o status é `noshow`, volta para `ativo` |
| 5 | Seletor nativo de hora pode confundir AM/PM dependendo do aparelho | já registrado em `docs/02-ux-ui.md` § 6.2 (residual, sev. 1) | Ambiguidade de entrada | Mantido como estava — depende do navegador/SO, não é algo que o app controle |
| 6 | Editar expediente/feriados exigia abrir o Supabase (Table Editor), inviável para a proprietária no dia a dia | Decisão inicial da seção 5 ("v3, não agora") | Controle de longo prazo pelo usuário final | **Corrigido**: tela **Horários** (`HorariosPage.tsx`, rota `/horarios`) — formulário por dia da semana + lista de feriados com adicionar/remover, usando as mesmas policies de RLS já existentes (sem mudança de schema) |

**O que ficou de fora de propósito (v3, não agora):**
- Feriados móveis (Páscoa, Carnaval) calculados automaticamente — exige uma lib de calendário, complexidade desproporcional ao MVP.
- Mais de uma pausa por dia, ou expediente partido em mais de 2 blocos — o modelo atual cobre o caso comum (um expediente, uma pausa), que já é suficiente para o problema real relatado.

> Nota sobre a tela Horários ser pública: como o MVP continua sem login (README § 07), qualquer pessoa com o link também consegue abrir `/horarios` e mudar o expediente — o mesmo risco aceito e documentado para as demais telas (RNF06), não um risco novo. Com login, essa tela seria a primeira candidata a exigir autenticação.

## 6 · Deploy

Isso depende da sua conta (Vercel ou Netlify — ambos têm plano grátis):

1. **Vercel** (mais simples para Vite): `vercel.com` → **Add New → Project** → importe `Butzki/serena-agenda` do GitHub → em **Root Directory**, aponte para `frontend` → nas **Environment Variables**, adicione `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` com os mesmos valores do `.env.local` → Deploy.
2. **Netlify** é equivalente: **Add new site → Import from Git**, **Base directory** `frontend`, **Build command** `npm run build`, **Publish directory** `frontend/dist`, e as mesmas variáveis de ambiente.

**Submissão (conforme o slide):** link do repositório + link do deploy.

## 7 · Checklist do entregável

- [x] 4 componentes base reutilizáveis (Button, Input, Card, Badge)
- [x] 4 telas React + Tailwind implementadas (+ 1 extra, Horários — seção 5, item 6)
- [x] Integração com Supabase funcionando (CRUD real, RLS da etapa 03)
- [x] Estados de UI em cada tela (loading/empty/success/error)
- [x] Validação client-side nos formulários
- [ ] Responsividade testada em 375px, 768px e 1280px — **depende de você** (abrir no navegador, ver seção 2)
- [x] Navegação entre as telas (barra inferior com 3 abas + links internos)
- [x] README com esta documentação (este arquivo)
- [ ] Deploy (Vercel/Netlify) — **depende de você** (seção 6)
