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

**4 telas** (`frontend/src/pages/`), mapeadas 1:1 nas rotas:

| Tela | Rota | Arquivo |
|---|---|---|
| Agenda do dia | `/agenda?data=` | `AgendaPage.tsx` |
| Novo agendamento | `/agenda/novo?data=&hora=` | `NovoAgendamentoPage.tsx` |
| Lista de serviços | `/servicos` | `ServicosPage.tsx` |
| Cadastro / edição de serviço | `/servicos/novo`, `/servicos/:id/editar` | `NovoServicoPage.tsx` |

Toda a casca comum (cabeçalho, toast, navegação inferior) está em `components/Layout.tsx`; o diálogo de confirmação (cancelar/excluir) em `components/ConfirmDialog.tsx` — ambos portados do HTML/CSS/JS do protótipo, não redesenhados do zero.

**Como foi produzido:** construído com apoio do Claude Code (agente de codificação), lendo o protótipo (`prototipo/js/app.js`) e os documentos das Aulas 01-03 como fonte de verdade para regras de negócio, nomes de campo e comportamento — não a partir de um prompt avulso de chat. A revisão humana aconteceu em duas rodadas: build de produção (`npm run build`, sem erros de tipo) e uma sessão de revisão de design (seção 5) que encontrou e corrigiu uma lacuna real antes de fechar a etapa.

## 2 · Como rodar e testar localmente

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

## 4 · Validação: front vs. banco

Pergunta do slide da Aula 04: *"você validou no front apenas formato (UX) e deixou integridade para o banco? Ou duplicou validação sem necessidade?"*

- **Formato** (tamanho mínimo de nome, dígitos do telefone, faixa de duração, horário dentro do expediente) é validado **só no front**, para dar feedback imediato — o banco também tem `check constraints` equivalentes (`supabase/schema.sql`), mas eles existem como rede de segurança, não como segunda fonte de mensagem de erro ao usuário.
- **Regra de negócio** (RF05 conflito de horário, e agora também "fechado aos domingos") é checada **nas duas camadas de propósito**: o front consulta antes de salvar (resposta rápida, com sugestão de horários), e o trigger do banco (`checar_conflito_agendamento`) é quem decide de verdade — se as duas discordarem (corrida entre duas abas, por exemplo), o erro do banco é capturado e reaproveitado na mesma UI de alerta (ver `NovoAgendamentoPage.tsx`).

## 5 · Revisão de design: problemas encontrados

Depois de montar as telas, revisei o projeto atrás de lacunas da **mesma categoria** do problema que você levantou ("o sistema assume um calendário de funcionamento idealizado, sem fechamento"). Three descobertas, duas já existentes nos documentos das aulas anteriores:

| # | Problema | Onde | Categoria | Status |
|---|---|---|---|---|
| 1 | Expediente fixo 8h–20h **todos os dias**, inclusive domingo | `lib/horarios.ts` (herdado do protótipo) | Calendário de funcionamento idealizado | **Corrigido agora**: `salaoFechado()` bloqueia domingo no front (`AgendaPage`, `NovoAgendamentoPage`) e no banco (trigger, `schema.sql`) |
| 2 | Feriados (Natal, etc.) não são bloqueados | mesma lacuna, mais ampla | Calendário de funcionamento idealizado | **Não implementado** — documentado como pendência abaixo; calendário de feriados móveis/regionais é complexidade de produto final, fora do escopo do MVP (README § 07) |
| 3 | Sem intervalo de almoço/pausa no meio do expediente — o sistema aceita agendar em qualquer janela entre 8h e 20h sem exceções | mesma lacuna, mesma raiz | Calendário de funcionamento idealizado | **Não implementado** — mesma justificativa do item 2 |
| 4 | "Não compareceu" não tem desfazer | já registrado em `docs/02-ux-ui.md` § 6.2 (H3, sev. 2) | Reversibilidade de ação (categoria adjacente, não a mesma) | Mantido como estava — fora do pedido atual |
| 5 | Seletor nativo de hora pode confundir AM/PM dependendo do aparelho | já registrado em `docs/02-ux-ui.md` § 6.2 (residual, sev. 1) | Ambiguidade de entrada, pode levar a agendar no horário errado | Mantido como estava — depende do navegador/SO, não é algo que o app controle |

**Pendências registradas para uma v2** (não implementadas de propósito, para não expandir o escopo do MVP sem necessidade):
- Lista de feriados (fixos e móveis) bloqueando agendamento.
- Configuração de expediente por dia da semana (hoje é um único par `HORA_ABRE`/`HORA_FECHA` para todos os dias que não sejam domingo).
- Intervalo de almoço/pausa configurável.
- Desfazer "não compareceu".

> Essas quatro pendências têm a mesma causa raiz: o modelo de dados não tem uma tabela de "exceções de expediente" (feriado, pausa, dia especial). Resolver as quatro juntas, numa tabela `excecoes_horario(data, hora_inicio, hora_fim, motivo)`, é a recomendação para a v2 — mas isso é desenho de produto final, não MVP (ver tabela "Três objetos, três objetivos" da Aula 01: MVP é "banco real, sem migrações"; uma tabela de exceções com motivo e tipo já pede uma migração de verdade).

## 6 · Deploy

Isso depende da sua conta (Vercel ou Netlify — ambos têm plano grátis):

1. **Vercel** (mais simples para Vite): `vercel.com` → **Add New → Project** → importe `Butzki/serena-agenda` do GitHub → em **Root Directory**, aponte para `frontend` → nas **Environment Variables**, adicione `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` com os mesmos valores do `.env.local` → Deploy.
2. **Netlify** é equivalente: **Add new site → Import from Git**, **Base directory** `frontend`, **Build command** `npm run build`, **Publish directory** `frontend/dist`, e as mesmas variáveis de ambiente.

**Submissão (conforme o slide):** link do repositório + link do deploy.

## 7 · Checklist do entregável

- [x] 4 componentes base reutilizáveis (Button, Input, Card, Badge)
- [x] 4 telas React + Tailwind implementadas
- [x] Integração com Supabase funcionando (CRUD real, RLS da etapa 03)
- [x] Estados de UI em cada tela (loading/empty/success/error)
- [x] Validação client-side nos formulários
- [ ] Responsividade testada em 375px, 768px e 1280px — **depende de você** (abrir no navegador, ver seção 2)
- [x] Navegação entre as 4 telas (barra inferior + links)
- [x] README com esta documentação (este arquivo)
- [ ] Deploy (Vercel/Netlify) — **depende de você** (seção 6)
