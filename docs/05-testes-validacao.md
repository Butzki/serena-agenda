# Serena Agenda · Testes e Validação (Aula 05)

> Exercício: submeter o MVP a 4 provas (funcional, integração, usabilidade e validação de requisitos), priorizar bugs, corrigir com apoio de IA e documentar.
> Deploy testado: <https://serena-agenda.vercel.app/agenda> · Código dos testes: [`frontend/tests/`](../frontend/tests) (unitários e banco) e [`frontend/e2e/`](../frontend/e2e) (Playwright).

## Sumário

1. [Resumo da execução](#1--resumo-da-execução)
2. [Estratégia e ambiente de teste](#2--estratégia-e-ambiente-de-teste)
3. [Teste funcional: casos da US-01](#3--teste-funcional-casos-da-us-01)
4. [Teste de integração (E2E) e demais histórias](#4--teste-de-integração-e2e-e-demais-histórias)
5. [Matriz de rastreabilidade RF/RNF → teste](#5--matriz-de-rastreabilidade-rfrnf--teste)
6. [Bugs: reprodução, diagnóstico e correção](#6--bugs-reprodução-diagnóstico-e-correção)
7. [Teste de usabilidade](#7--teste-de-usabilidade)
8. [MoSCoW atualizado](#8--moscow-atualizado)
9. [Limitações da IA encontradas](#9--limitações-da-ia-encontradas)
10. [Como rodar](#10--como-rodar)
11. [Checklist do entregável](#11--checklist-do-entregável)

---

## 1 · Resumo da execução

Execução de 25/11/2026, depois das correções e da revisão com a proprietária:

| Camada | Ferramenta | Casos | Resultado |
|---|---|---|---|
| Unitário (regras de horário, máscaras, limite de antecedência) | Vitest | 29 | ✅ 29 passaram |
| Banco (schema.sql real: constraints + trigger, data passada, antecedência) | Vitest + PGlite | 23 | ✅ 23 passaram |
| E2E / integração (front → API → banco → tela) | Playwright, Chrome mobile (Pixel 5) | 37 | ✅ 37 passaram |
| ↳ dentro dos E2E: responsividade (320, 375, 768, 1280 px × 5 telas) | Playwright | 4 | ✅ sem rolagem horizontal |
| ↳ dentro dos E2E: acessibilidade (WCAG 2.x A/AA) | axe-core | 1 (5 telas) | ✅ 0 violações |
| **Total automatizado** | | **89** | **0 falhas** |

**Antes das correções**, a mesma suíte tinha **4 testes falhando** (BUG-01 ×2, BUG-02, BUG-03), que é a evidência de que os bugs eram reais. Cada correção foi um commit separado, e o teste que falhava passou a passar (ver § 6).

**Revisão pós-entrega inicial (25/11):** a proprietária revisou o resultado e mudou três coisas: o BUG-02 virou mudança de requisito (§ 6.2), os BUG-04 e BUG-05 foram corrigidos (§ 6.4) e entrou o limite de antecedência de agendamento. Por isso o BUG-04 deixou de ser "falha esperada" e a suíte fechou com 0 falhas.

Medições automatizadas (banco de teste local, então não representam a rede 4G real):

| Critério | Meta | Medido |
|---|---|---|
| US-01 AC4: serviço aparece na lista após salvar | < 1 s | 129 ms |
| US-04 AC4: trocar de data atualiza a lista | < 1 s | 89 ms |
| US-02 AC3: registrar agendamento | < 30 s | 0,6 s pelo robô; o tempo **humano** é medido no teste de usabilidade (§ 7) |

---

## 2 · Estratégia e ambiente de teste

**Regra da aula: banco de testes com dados seed, jamais o banco de produção.** O Supabase de produção (`qnrvpxiagyqmygvgfwnk`) não é tocado por nenhum teste automatizado.

| Camada | O que valida | Onde roda |
|---|---|---|
| Unitário | Funções puras de `lib/horarios.ts` (conflito, expediente, pausa, feriado, sugestões, máscaras) | Node (Vitest) |
| Banco | `supabase/schema.sql` + `seed.sql` **reais**: check constraints e o trigger `checar_conflito_agendamento` | Postgres 16 em memória ([PGlite](https://pglite.dev)) |
| E2E | Navegador real clicando nas telas reais; o front fala com uma API REST igual à do Supabase (`/rest/v1`), servida sobre o mesmo schema real | Playwright + Chrome, perfil Pixel 5, fuso `America/Sao_Paulo` |

O servidor de teste ([`e2e/support/fake-supabase.mjs`](../frontend/e2e/support/fake-supabase.mjs)) sobe o schema e o seed num Postgres em memória e implementa o subconjunto da API do PostgREST que o app usa (select com embed `servico:servicos(*)`, filtros `eq/gte`, `order`, insert, update, delete, upsert, `count`). Cada teste chama `/__reset` e começa com o banco limpo.

Por que assim e não `supabase start`: roda em qualquer máquina e no CI sem Docker e sem conta, em ~2 min. O preço é que a API é uma reimplementação (ver limitação L6 no § 9). Para rodar a mesma suíte contra um Supabase de **teste** (nunca o de produção), basta definir `E2E_SUPABASE_URL` e `E2E_SUPABASE_ANON_KEY`.

---

## 3 · Teste funcional: casos da US-01

**US-01 · Cadastrar serviço.** Os ACs do nosso README (Aula 01) diferem um pouco do exemplo do slide (aqui o AC1 junta nome, duração e preço; o AC2 é "só inteiros"; o AC3 é a máscara de R$). Por isso os casos seguem o **nosso** documento, não a numeração do slide. Todos são automatizados ([`e2e/us01-servico.spec.ts`](../frontend/e2e/us01-servico.spec.ts)) e repetidos na camada de banco ([`tests/db/schema.test.ts`](../frontend/tests/db/schema.test.ts)).

**Pré-condição comum:** banco de teste com o seed (Corte feminino 60 min R$ 80, Manicure 40 min R$ 35, Escova 30 min R$ 50); tela `/servicos/novo`.

| ID | AC | Tipo | Passos | Esperado | Obtido |
|---|---|---|---|---|---|
| CT-01 | AC1 | ✅ positivo | Nome "Pés", 30 min, R$ 25,00 → Salvar | Salva, volta para a lista, toast "Serviço salvo." | ✅ Passou |
| CT-02 | AC1 | ❌ negativo | Nome "Pé " (2 letras + espaço) → Salvar | Erro "pelo menos 3 letras", campo com `aria-invalid`, nada no banco | ✅ Passou |
| CT-03 | AC1 | ✅ limite | Duração 10 e depois 480 | Salva as duas | ✅ Passou |
| CT-04 | AC1 | ❌ limite | Duração 5 e depois 500 | Erro "de 10 a 480", nada no banco | ✅ Passou |
| CT-05 | AC2 | ❌ formato | Digitar `-4,5a` na duração | Campo fica `45` (só dígitos) | ✅ Passou |
| CT-06 | AC3 | ✅ formato | Digitar `125000` no preço | Campo mostra `R$ 1.250,00` | ✅ Passou |
| CT-07 | AC1/AC3 | ✅ / ❌ | Preço R$ 0,00 → erro; R$ 0,01 → salva | Erro "maior que R$ 0,00"; depois salva com `0.01` no banco | ✅ Passou |
| CT-08 | AC4 | ✅ desempenho | Salvar serviço válido e cronometrar até aparecer na lista | < 1 s | ✅ 129 ms |
| CT-09 | AC5 | ✅ | Preencher e tocar "Cancelar" | Volta à lista, nada persistido | ✅ Passou |
| CT-10 | AC6 | ❌ rede | Derrubar a rede no POST e salvar | "Não foi possível salvar. Verifique sua conexão…", dados mantidos | ✅ Passou |
| CT-11 | RF03 | ✅ | Editar Escova → R$ 55,00 | Lista mostra "30 min · R$ 55,00" | ✅ Passou |
| CT-12 | RF03 | ✅ | Excluir Manicure → confirmar | Diálogo de confirmação, toast "Serviço excluído.", some da lista | ✅ Passou |
| BUG-04 | AC6 | ❌ | Digitar 12 dígitos no preço (acima de R$ 99.999.999,99) | A máscara para no limite e salva; erro de dado do banco não culpa a conexão | ✅ Passou (corrigido, § 6.4) |

**12 casos (+1 bug aberto) para 6 ACs, cada AC com positivo e negativo.** O slide pedia 9; os 3 extras cobrem o RF03 (editar/excluir), que na matriz do professor aparecia como "parcial".

---

## 4 · Teste de integração (E2E) e demais histórias

Arquivo principal: [`e2e/fluxo-agendamento.spec.ts`](../frontend/e2e/fluxo-agendamento.spec.ts). O E2E-01 é o fluxo pedido no slide, adaptado ao nosso MVP (sem login: decisão do README § 07).

| ID | Cenário | US / AC | Resultado |
|---|---|---|---|
| E2E-01 | Cadastrar "Escova modelada" 45 min R$ 70 → agendar Ana Lima às 14:00 → agenda mostra o card "Ocupado" → linha conferida no banco (RF09) | US-01, US-02 AC4, US-04 | ✅ |
| E2E-02 | Agendar 14:30 sobre um Corte 14:00–15:00 → alerta "Horário indisponível" com quem está no horário → sugestões 15:00 / 15:30 / 16:00 → tocar 15:00 salva | US-03 AC1, AC4 | ✅ |
| E2E-03 | Agendar 15:00 logo após um corte que termina 15:00 | US-03 AC2 | ✅ |
| E2E-04 | **Corrida entre duas abas:** outro agendamento entra no banco depois da checagem do front → o trigger barra e a tela mostra o motivo | US-03 (defesa em profundidade) | ✅ |
| E2E-05 | Campos obrigatórios vazios; data passada | US-02 AC1, AC2 | ✅ |
| E2E-06 | Domingo e feriado (25/12, do seed) bloqueiam | v2 calendário | ✅ |
| E2E-07 | Agenda ordenada por hora, janela livre entre agendamentos, troca de data < 1 s | US-04 AC1, AC3, AC4 | ✅ |
| US05-01 | Cancelar pede confirmação; "Voltar" não altera; confirmar libera o horário | US-05 AC1 | ✅ |
| US05-02 | "Não compareceu" fica no histórico; cancelado não tem mais botões de ação | US-05 AC2, AC3 | ✅ |
| BUG-01 ×2 | Erro ao cancelar ou ao desfazer no-show aparece na tela | US-05 AC4 | ✅ (falhava antes) |
| BUG-02 → US05-03 | No-show mantém o horário como **perdido** (não vira janela livre) e é contado à parte | US-05 AC2 | ✅ (requisito revisado, § 6.2) |
| BUG-04 ×2 | Máscara de preço para no limite; erro 22xxx/23xxx do banco não vira "conexão" | US-01 AC6 | ✅ (falhava antes) |
| ANT-01…04 | Limite de antecedência: `max` do seletor, mensagem, configurar para 60 dias, valor inválido | US-02 AC5 | ✅ |
| BUG-03 ×2 | Aumentar duração que sobrepõe agendamentos pede confirmação | RF03 / RF05 | ✅ (falhava antes) |

---

## 5 · Matriz de rastreabilidade RF/RNF → teste

| Requisito | Teste correspondente | Status |
|---|---|---|
| RF01 Cadastrar serviço | CT-01 a CT-10, banco "US-01 constraints", E2E-01 passo 1 | ✅ |
| RF02 Listar serviços | CT-08, CT-11, E2E-01 passo 1 | ✅ |
| RF03 Editar e excluir serviço | CT-11 (editar), CT-12 (excluir com confirmação), banco "on delete set null", BUG-03 | ✅ (no slide do professor estava "parcial": aqui a exclusão foi testada) |
| RF04 Cadastrar agendamento vinculado a serviço | E2E-01 passo 2, E2E-05 | ✅ |
| RF05 Impedir conflito (com duração) | 18 unitários (conflito + calendário), 8 de banco (trigger), E2E-02, E2E-03, E2E-04, E2E-06 | ✅ |
| RF06 Consultar por data (livre/ocupado/perdido) | E2E-01 passo 3, E2E-07, US05-03 | ✅ |
| RF07 Cancelar / não compareceu | US05-01, US05-02, US05-03, BUG-01 | ✅ |
| RF08 Validar formulários | CT-02, CT-04, CT-05, CT-07, E2E-05, ANT-02, ANT-04, BUG-04, máscaras (unitário), banco (data passada, antecedência) | ✅ |
| RF09 Persistir em banco remoto | Conferência no banco em CT-02, CT-07, CT-09, E2E-01, E2E-04 | ✅ no banco de teste · ⏳ produção: conferir na demo |
| RNF01 Responsivo, sem rolagem horizontal ≥ 320 px | `responsivo-a11y.spec.ts`: 5 telas × 320/375/768/1280 | ✅ · ⏳ celular Android real (§ 7) |
| RNF02 Carregamento < 2 s em 4G | Lighthouse no deploy (§ 10): FCP 1,0 s, LCP 2,5 s | ⚠️ parcial: primeira tela < 2 s, LCP acima da meta |
| RNF03 Acessibilidade | axe-core: 0 violações nas 5 telas · Lighthouse 100 | ✅ · ⏳ teclado/leitor de tela manual |
| RNF04 Disponibilidade | — | Fora do teste: SLA do Vercel/Supabase |
| RNF05 Chaves fora do client, HTTPS, coleta mínima | Inspeção: `.env.local` fora do git, só a chave pública no bundle, formulário só com nome e telefone | ✅ inspeção manual |
| RNF06 Aviso de privacidade e `noindex` | Aviso visível no formulário (screenshot), `<meta name="robots" content="noindex">` em `index.html` | ✅ inspeção |

**Cobertura:** 9 de 9 RFs com teste automatizado; RNF01, RNF03, RNF05 e RNF06 verificados; RNF02 e os testes em aparelho real dependem de execução manual no deploy.

---

## 6 · Bugs: reprodução, diagnóstico e correção

Workflow de 5 passos da aula: **reproduzir isoladamente → colar contexto completo → pedir hipóteses (não "corrija") → validar antes de aplicar → re-testar**. Cada bug virou primeiro um teste que **falhava**; a correção é um commit isolado, e o mesmo teste passou a **passar**.

Priorização (impacto × esforço):

| Bug | Impacto | Esforço | Prioridade | Status |
|---|---|---|---|---|
| BUG-01 Ações da agenda falham em silêncio | Alto: a proprietária acha que cancelou e não cancelou | Baixo | **Must** | ✅ Corrigido |
| BUG-02 "Não compareceu" continua ocupando a agenda | Era tratado como bug; a proprietária mostrou que o comportamento original estava certo | Baixo | **Should** | ✅ Reclassificado: mudança de requisito (§ 6.2) |
| BUG-03 Mudar duração do serviço sobrepõe agendamentos em silêncio | Alto: recria o problema nº 1 da persona (duas clientes juntas) | Médio | **Must** | ✅ Corrigido |
| BUG-04 Erro de validação do banco aparece como "erro de conexão" | Baixo: caso raro (preço absurdo) | Baixo | Could | ✅ Corrigido (25/11) |
| BUG-05 Banco aceita agendamento em data passada | Baixo: só via API; a tela bloqueia | Baixo | Could | ✅ Corrigido (25/11), junto com o limite de antecedência |

### 6.1 · BUG-01 · Cancelar, "não compareceu" e "desfazer" falham em silêncio

- **Reprodução:** agenda com Ana Lima (no-show às 14:00) e Bia Souza (ativa às 14:00, horário reaproveitado). Tocar "Desfazer" no card da Ana. **Obtido:** nada acontece, sem mensagem. Mesmo efeito ao cancelar sem internet.
- **Requisito violado:** US-05 AC4 ("em erro de rede, o status anterior é mantido e a mensagem informa a falha").
- **Hipóteses levantadas com a IA:**
  1. O update não chega ao banco (rede). Verificação: DevTools → Network mostra o PATCH falhando.
  2. O banco recusa (trigger: voltar para `ativo` reativa a checagem de conflito). Verificação: rodar o mesmo `update` no SQL Editor → `Conflito de horário…`.
  3. O front recebe o erro e o descarta. Verificação: ler `AgendaPage.tsx` → `if (error) return;` nas três funções.
- **Diagnóstico:** 2 e 3 confirmadas, e a 3 é a causa raiz. O protótipo da Aula 02 usava `localStorage`, que não falha; ao portar para rede, o padrão "sem tratamento de erro" veio junto.
- **Correção** (commit `fix(agenda): erro ao cancelar/no-show/desfazer…`): as três ações passam por `mudarStatus()`, que mantém o status e mostra um `role="alert"`: a mensagem do trigger quando é regra de negócio (`P0001`), ou "Verifique sua conexão" quando é rede.
- **Re-teste:** `BUG-01 · AC4` e `BUG-01 · desfazer…` falhavam → passam.

### 6.2 · BUG-02 · "Não compareceu" continua ocupando o horário na agenda → reclassificado como mudança de requisito

- **Reprodução:** Ana Lima marcada como "não compareceu" às 14:00. A agenda não mostra janela livre das 14:00 e o contador diz "1 ocupado". Porém, ao criar um agendamento às 14:00, o sistema **aceita** (front e trigger só bloqueiam `ativo`).
- **Diagnóstico:** duas regras diferentes para "ocupado". `AgendaPage.tsx` usava `status !== 'cancelado'` (herdado de `prototipo/js/app.js`, linha 61); `conflito()` e o trigger usam `status = 'ativo'`. A US-05 define que marcar no-show serve "para liberar o horário", então a tela é que estava errada.
- **Correção:** `ativos = agendamentos.filter(a => a.status === 'ativo')`. O card de no-show continua visível (histórico, US-05 AC2).
- **Re-teste:** `BUG-02` falhava → passava. Os testes US05-01/02 continuavam passando.
- **Revisão da proprietária (25/11): o "bug" estava certo e o "conserto" estava errado.** "Não compareceu" só se marca depois que o horário passou, e a tela não deixa agendar no passado. Liberar o horário na agenda não serve a ninguém: o que a dona quer ver é que **o horário se perdeu**, diferente do cancelamento, que sim libera. A IA tinha seguido a US-05 ao pé da letra ("para liberar o horário") sem questionar o uso real (ver L9).
- **Decisão final:** no-show **continua ocupando o eixo da agenda** (não vira janela livre), mas deixa de ser contado como "ocupado" e passa a aparecer num contador próprio ("1 horário perdido"). A US-05 foi reescrita no README. Teste: `US05-03`. A regra de conflito do banco não mudou (só `ativo` bloqueia), o que é inofensivo: o horário já passou e a tela e o banco recusam agendar no passado.

### 6.3 · BUG-03 · Aumentar a duração de um serviço sobrepõe agendamentos já marcados

- **Reprodução:** Ana Lima (Escova 30 min, 14:00–14:30) e Bia Souza (Manicure, 14:30). Editar Escova para 60 min → salva sem aviso. Agora Ana vai até 15:00 e as duas clientes se sobrepõem: exatamente a dor nº 1 da persona Mariana.
- **Diagnóstico:** o trigger de conflito roda em `agendamentos`, mas o fim de cada agendamento é calculado com `servicos.duracao_min`. Mudar o serviço muda retroativamente todos os agendamentos, sem passar pelo trigger. Nenhum teste da Aula 04 cobria "editar serviço com agendamentos futuros".
- **Decisão de produto (humana):** **avisar e deixar decidir**, em vez de bloquear. Pode ser intencional (o serviço realmente demora mais) e a proprietária pode remarcar a cliente pelo WhatsApp.
- **Correção:** ao aumentar a duração, `NovoServicoPage` busca os agendamentos ativos de hoje em diante, simula a nova duração com a mesma `conflito()` da agenda e, se houver sobreposição, abre um diálogo listando quem colide ("Ana Lima em 25/11 às 14:00…"). "Voltar" não salva.
- **Re-teste:** `BUG-03 · …pede confirmação` falhava → passa; `BUG-03 · …sem conflito salva direto` garante que o caso comum não ganhou atrito.

### 6.4 · Bugs abertos (backlog)

- **BUG-04 ✅ corrigido (25/11):** preço acima de R$ 99.999.999,99 estourava `numeric(10,2)` e a tela dizia "Verifique sua conexão". Correção: a máscara corta em 10 dígitos (`PRECO_MAX_DIGITOS`) e erros `22xxx/23xxx` (dado inválido) ganham mensagem própria, separada da falha de rede. A marcação `test.fail()` foi removida e virou 2 testes comuns.
- **BUG-05 ✅ corrigido (25/11):** o trigger agora recusa data/hora passada (fuso `America/Sao_Paulo`), **só no `insert`**: cancelar, marcar no-show e desfazer um agendamento que já passou continuam permitidos. Coberto por testes de banco.
- **Novo: limite de antecedência (US-02 AC5).** Pedido da proprietária: não aceitar agendamento muito distante. Tabela `configuracao` (linha única, `antecedencia_max_dias`, padrão 30, entre 1 e 365), editável na tela Horários. Vale na tela (`max` do seletor + mensagem) e no trigger. Se a tabela ainda não existir (schema antigo), a tela assume 30 dias.
- **Atenção ao publicar:** o schema novo precisa ser executado no Supabase de produção (SQL Editor, arquivo `supabase/schema.sql` inteiro; é idempotente e não apaga dados). Sem isso o banco de produção não tem a tabela `configuracao` nem as regras novas do trigger.
- **Observação (não é bug do app):** os campos de data e hora usam o seletor nativo, cujo formato segue o idioma do aparelho (no Chrome de teste em inglês apareceu `11/25/2026` e `02:15 PM`). Já estava registrado na Aula 02 (§ 6.2, residual sev. 1) e reforça o teste em celular real.

### 6.5 · Prompt CTQ de depuração usado (BUG-03)

```
# CONTEXTO
Projeto: Serena Agenda (MVP). Stack: React 18 + Vite + Tailwind 3 + Supabase JS SDK.
PostgreSQL com RLS e trigger checar_conflito_agendamento (BEFORE INSERT OR UPDATE ON agendamentos).
Bug reportado:
- Tela: Serviços → Editar
- Sintoma: aumentar duracao_min de 30 para 60 salva sem aviso; dois agendamentos passam a se sobrepor na agenda
- Console: nenhum erro; PATCH /servicos retorna 204
- Reprodução: 100% (teste e2e/servico-duracao.spec.ts)
Anexos: supabase/schema.sql (trigger), NovoServicoPage.tsx, lib/horarios.ts (conflito()).
# TAREFA
1. Liste 3 hipóteses prováveis.
2. Para cada uma: sintoma esperado, como verificar (SQL, log, DevTools), fix sugerido (sem aplicar).
3. Indique a mais provável, com justificativa.
4. Proponha o fix como diff (não reescreva o arquivo).
# QUEM
Engenheiro front-end sênior + DBA especializado em Supabase.
# FORMATO
Markdown, hipóteses numeradas, diff em bloco. No final: "Próximo passo: valide a hipótese X rodando <query>".
```

A IA propôs três caminhos: (a) trigger em `servicos` que recusa o update; (b) aviso no front; (c) não fazer nada e documentar. A query de verificação sugerida (`select` dos agendamentos futuros do serviço com o fim recalculado) confirmou a sobreposição. **A escolha entre (a) e (b) foi humana**: bloquear tiraria da proprietária uma decisão legítima.

---

## 7 · Teste de usabilidade

> ⏳ **Precisa ser executado com pessoas.** A IA não pode observar colegas usando o sistema; por isso esta seção é um roteiro e uma ficha em branco, e não um resultado inventado. Os números entram depois da sessão.

**Participantes:** 2 a 3 colegas que nunca viram o Serena Agenda, usando o **próprio celular** no link do deploy. **Antes:** rodar `supabase/seed.sql` num estado conhecido ou combinar nomes de teste fáceis de apagar (ex.: "Teste Usab 1").

**Roteiro (5 min, sem explicar como fazer):**

> "Você é dona de um salão. Use este sistema como se fosse seu. Pense em voz alta enquanto usa. Eu não vou ajudar: se travar, me diga o que está pensando."

1. **Tarefa 1:** cadastre um serviço chamado **Escova**, 30 minutos, **R$ 50**.
2. **Tarefa 2:** a cliente **Ana** ligou. Marque esse serviço para ela **amanhã às 14h** (telefone: invente um).
3. **Tarefa 3:** a **Bia** quer o mesmo horário, amanhã às 14h. Tente marcar. *(Observa: entende o alerta de conflito? Usa as sugestões?)*
4. **Tarefa 4:** a Ana desmarcou. Libere o horário dela.

**Regras do observador:** não corrigir, não apontar botões, anotar cada hesitação (parou > 3 s) e cada clique errado.

**Ficha (uma por participante):**

| Métrica | P1 | P2 | P3 |
|---|---|---|---|
| Aparelho / navegador | | | |
| Tempo total (min) | | | |
| Tempo só da tarefa 2 (meta US-02 AC3: < 30 s) | | | |
| Cliques até concluir | | | |
| Erros (clique errado, dígito errado) | | | |
| Hesitações visíveis | | | |
| Pediu ajuda? (S/N) | | | |
| Entendeu o alerta de conflito? (S/N) | | | |
| Comentário mais marcante (literal) | | | |

**Problema recorrente (≥ 2 participantes) = bug de UX** → registrar aqui como BUG-06+, com severidade 0–4 (Nielsen), e decidir na § 8 se entra antes da apresentação.

| # | Problema observado | Quantos tiveram | Severidade | Decisão |
|---|---|---|---|---|
| | | | | |

**Hipóteses a observar** (vindas da análise do código, não de usuários): o botão "Não compareceu" quebra em duas linhas em 390 px; o seletor de hora nativo pode mostrar AM/PM; a aba "Horários" pode ser confundida com "horários livres".

---

## 8 · MoSCoW atualizado

| | Funcionalidade | Situação após a Aula 05 |
|---|---|---|
| **Must** | CRUD de serviços (RF01–RF03) | ✅ testado (12 casos) |
| | Cadastrar agendamento + validação (RF04, RF08) | ✅ |
| | Impedir conflito, no front e no banco (RF05) | ✅ incluindo corrida entre abas |
| | Agenda do dia com livre/ocupado (RF06) | ✅ |
| | Persistência remota (RF09) | ✅ |
| | Responsivo mobile + estados de UI | ✅ automático · ⏳ aparelho real |
| | **Correção BUG-01 e BUG-03** | ✅ feito nesta aula |
| **Should** | Cancelar / não compareceu / desfazer (RF07) | ✅ |
| | Calendário de funcionamento (expediente, pausa, feriados) | ✅ |
| | **BUG-02 reclassificado** (no-show = horário perdido, visível) | ✅ |
| | Limite de antecedência configurável (padrão 30 dias) | ✅ |
| | Teste de usabilidade com 2–3 colegas | ⏳ antes da apresentação |
| | Lighthouse no deploy (RNF02) | ✅ executado (§ 10); LCP 2,5 s fica como melhoria |
| **Could** | ~~BUG-04 e BUG-05~~ | ✅ corrigidos em 25/11 |
| | Acesso mínimo protegido (senha única ou Supabase Auth) | risco aceito no README; **primeira** prioridade da v2 |
| | Lembrete por WhatsApp (link `wa.me` com mensagem pronta) | ataca o no-show (dor nº 3) |
| | Editar agendamento existente | hoje é cancelar e recriar |
| **Won't (agora)** | Agendamento pela própria cliente, pagamento/sinal, app nativo, multi-salão, offline com sincronização, feriados móveis | mantido do README § 07 |

**Regra de corte:** se faltar tempo antes da apresentação, sacrificar na ordem Won't → Could → Should. Os Musts estão entregues e testados.

---

## 9 · Limitações da IA encontradas

Fatos observados neste projeto, não uma lista genérica:

| # | O que aconteceu | Categoria (slide) | Como foi pego |
|---|---|---|---|
| L1 | Ao escrever o CT-01, a IA usou o nome `"Pé "` como caso **válido** de 3 caracteres. O app faz `trim()` e corretamente recusou; o teste é que estava errado. | Falsa confiança | Rodar o teste e ler a falha antes de "corrigir" o app |
| L2 | O BUG-02 parecia uma divergência de regra (`!== 'cancelado'` na tela × `=== 'ativo'` no conflito), e a IA "corrigiu" a tela. Estava errada: ver L9. | Contexto / reprodução de padrão | Revisão da proprietária |
| L3 | O BUG-01 também veio do porte: o protótipo usava `localStorage` (não falha) e o código de rede herdou o "ignora erro". | Contexto incompleto | Teste com rede derrubada (`page.route → abort`) |
| L4 | A doc da Aula 03 dizia que o trigger foi "testado mentalmente". Nesta aula ele rodou de verdade (23 testes de banco); passou, mas o teste mental não teria achado o BUG-03, que está **fora** do trigger. | Falsa confiança | Testes de banco + E2E de edição |
| L5 | Na escolha do fix do BUG-03, a IA ofereceu "bloquear no banco" e "avisar na tela" com a mesma confiança. É decisão de produto, não técnica. | Decisão humana | Humano decidiu: avisar |
| L6 | O banco de teste é Postgres real, mas a API REST é uma reimplementação para teste. Pode divergir do PostgREST do Supabase (versão, RLS por papel `anon`). | Ambiente / fidelidade | Mitigação: conferir o fluxo da demo no deploy real antes de apresentar |
| L7 | O ambiente da IA não acessa o deploy na Vercel nem um celular real: Lighthouse em 4G, o teste em Android e o teste com colegas ficam com o humano. | Limite de acesso | Itens ⏳ nas §§ 5, 7 e 8 |
| L8 | Nenhum segredo foi colado em prompt: a IA trabalhou só com `.env.local.example` e uma chave falsa de teste. | Vazamento de dados (evitado) | `.gitignore` + chave fake nos E2E |

| L9 | A IA aplicou a US-05 ao pé da letra ("no-show libera o horário") e transformou um comportamento correto da tela em "bug". Faltou pensar no uso real: no-show é registrado depois que o horário passou, e a dona quer ver o prejuízo. Foi ela quem corrigiu. | Falsa confiança / falta de contexto de uso | Revisão humana do resultado, não um teste: o teste só confirmava a regra errada |

**Quando paramos de usar IA:** na decisão do BUG-03 (produto), no teste de usabilidade (só humanos) e na base legal da LGPD (README, segue como hipótese a confirmar com o salão).

---

## 10 · Como rodar

```bash
cd frontend
npm install
npx playwright install chromium   # 1ª vez (ou use PW_CHROME_PATH=/caminho/do/chrome)

npm test            # unitários + banco (Vitest), ~30 s
npm run test:e2e    # E2E (Playwright): sobe banco de teste em :54321 e o Vite em :5174, ~2 min
npx playwright show-report e2e-report   # relatório HTML, com trace dos testes que falharem
```

Screenshots de responsividade (375 e 1280 px) ficam em `frontend/e2e-evidencias/` (fora do git).

**Checagens manuais no deploy (antes da apresentação):**
1. **Lighthouse** (RNF02, RNF03): Chrome → DevTools → Lighthouse → Mobile, com throttling "Slow 4G". **Executado em 25/11/2026** (Lighthouse 13.6, Moto G Power emulado, 4G lento simulado, `https://serena-agenda.vercel.app/agenda`):

   | Performance | Accessibility | Best Practices | SEO | FCP | LCP | TBT | CLS |
   |:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
   | 92 | 100 | 100 | 45 | 1,0 s | 2,5 s | 270 ms | 0 |

   - **RNF03 (acessibilidade): atendido**, 100 no Lighthouse e 0 violações no axe.
   - **RNF02 (< 2 s em 4G): parcial.** A primeira tela aparece em 1,0 s, mas o LCP é 2,5 s, acima da meta. Melhoria futura: reduzir JavaScript não usado e requisições que bloqueiam a renderização.
   - **SEO 45 é intencional** (RNF06): a página é `noindex`, sem meta description e o `robots.txt` cai no fallback do SPA. O sistema é interno e não deve aparecer em buscas.
2. **Celular Android real:** abrir o link, fazer o roteiro da demo, conferir que nada transborda.
3. **Ensaiar a demo 3 vezes** com cronômetro e gravar um vídeo de 2 min como plano B.

---

## 11 · Checklist do entregável

- [x] Matriz de rastreabilidade RF → teste (§ 5)
- [x] Casos de teste da US-01 (12 casos + 1 bug aberto, § 3)
- [x] Teste E2E em Playwright executável (`npm run test:e2e`, § 4)
- [ ] Relatório de teste de usabilidade com 2 colegas (roteiro e ficha prontos, § 7: **falta executar**)
- [x] 3 bugs documentados: reprodução + diagnóstico + fix (§ 6.1–6.3), com commits separados (o 2º foi revisto e reclassificado, § 6.2)
- [x] MoSCoW atualizado (§ 8)
- [x] Seção "Limitações da IA encontradas" (§ 9, também resumida no README)
