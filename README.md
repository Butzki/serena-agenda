# Serena Agenda — Documento de Requisitos (MVP)

> **Documento de requisitos gerado por IA, validado por humanos.**
> Disciplina: Prototipação Rápida de Aplicações com IA · Exercício 01
> Status: rascunho v0.1. Personas e entrevista são **hipóteses** até a validação com usuários reais (3–5 entrevistas).

## Resumo em 5 minutos

- **Problema:** o salão agenda por WhatsApp e caderno, e isso gera conflitos de horário e no-shows.
- **Solução (MVP):** web app mobile-first, sem login, para cadastrar serviços e agendamentos e alertar conflitos.
- **Persona primária:** Mariana, cabeleireira e proprietária, que registra tudo pelo celular durante o atendimento.
- **Escopo:** 9 RFs, 6 RNFs mensuráveis, 5 histórias de usuário com critérios de aceite testáveis.
- **Fora do MVP:** login, agendamento pela cliente, lembretes, pagamento, modo offline.
- **Status:** validado documentalmente com referências (ver [Validação humana](#validação-humana)); falta validar com usuárias reais.

## Sumário

1. [Contexto](#01--contexto)
2. [Descoberta: entrevista simulada e personas](#02--descoberta-entrevista-simulada-e-personas)
3. [Requisitos funcionais](#03--requisitos-funcionais)
4. [Requisitos não funcionais](#04--requisitos-não-funcionais)
5. [Histórias de usuário](#05--histórias-de-usuário)
6. [Critérios de aceite](#06--critérios-de-aceite)
7. [Fora de escopo](#07--fora-de-escopo-mvp)
8. [Validação humana](#validação-humana)
9. [Referências](#referências)
10. [Apêndice: prompts utilizados](#apêndice--prompts-utilizados)

---

## 01 · Contexto

A **Serena Salon Studio** (Lages/SC) agenda seus serviços por WhatsApp e caderno de papel. Isso gera conflitos de horário, no-shows e retrabalho. A proprietária precisa de um **sistema web simples, mobile-first e sem instalação** para cadastrar serviços, consultar disponibilidade e registrar agendamentos.

- **Público:** proprietária e equipe do salão (uso interno).
- **Restrições do MVP:** sem login; CRUD com persistência em banco remoto; interface responsiva; uso principal pelo celular, durante o atendimento.
- **Objetivo do MVP:** eliminar conflitos de horário e substituir o caderno.

---

## 02 · Descoberta: entrevista simulada e personas

### 2.1 Entrevista simulada (10 min)

> ⚠️ Saída de IA com a IA no papel de cliente. É **hipótese, não dado**. Confirmar com usuários reais.

**Entrevistada simulada:** Mariana, 32, cabeleireira e proprietária de salão em Lages/SC.

**Você:** Olá Mariana, conte como você agenda hoje.
**Mariana:** Anoto no caderno e também respondo as clientes no WhatsApp. Se a cliente muda de horário, risco e reescrevo. Já perdi cliente por confusão de horário.

**Você:** Me conta de uma vez em que isso deu errado.
**Mariana:** Sábado passado duas clientes chegaram juntas para o mesmo horário. Eu tinha marcado uma pelo WhatsApp e a outra pelo caderno, e não conferi.

**Você:** O que mais te incomoda nesse processo?
**Mariana:** Quando duas clientes chegam juntas, não sei quem chegou primeiro. E quando a cliente simplesmente não aparece: fico com a cadeira vazia e não consigo encaixar ninguém.

**Você:** Em que momento do dia você mexe na agenda?
**Mariana:** Quase sempre com a mão ocupada, no meio de um atendimento. Se demora mais de meio minuto, eu desisto e anoto no papel.

**Você:** E se o sistema avisasse quando há conflito?
**Mariana:** Seria ótimo. Mas tem que ser no celular, não dou conta de abrir computador no salão.

**Você:** O que faria você abandonar uma ferramenta nova?
**Mariana:** Se eu precisar criar conta, instalar app ou se ficar lenta. Também tenho medo de perder os dados.

**Você:** Liste suas dores em ordem de importância.
**Mariana:** 1) Conflito de horário. 2) Anotar rápido, pelo celular. 3) No-show. 4) Lembrar preço e duração de cada serviço. 5) Medo de perder o caderno/dados.

**Insights extraídos (hipóteses):**

| # | Insight | Vira requisito |
|---|---|---|
| I1 | Conflitos de horário são a maior dor. | RF05, US-03 |
| I2 | Uso com as mãos ocupadas: o registro deve levar menos de 30 s no celular. | RNF01, RNF02, US-02 |
| I3 | Não quer criar conta nem instalar app. | Sem login (fora de escopo), web responsivo |
| I4 | No-show é recorrente e precisa ser registrado. | RF07 |
| I5 | Esquece preço e duração dos serviços. | RF01, RF02, RF03 |
| I6 | Medo de perder dados. | RF09, RNF05 |

### 2.2 Três personas (hipóteses)

#### Persona 1: Mariana Souza (**PRIMÁRIA**)

| Item | Descrição |
|---|---|
| Perfil | 32 anos, cabeleireira e proprietária de salão, Lages/SC, empreende há 6 anos |
| Tecnologia | Intermediária (WhatsApp, Instagram) |
| Perfil de adoção | Adotante pragmática: usa se for rápido |
| **Dor principal** | Conflito de horários e clientes que chegam juntas sem aviso |
| **Cenário de uso** | No salão, durante um atendimento, registra um agendamento pelo celular em menos de 30 s |
| **Métrica de sucesso** | Zero conflitos de horário por semana |

#### Persona 2: Rafael Lima (secundária, early adopter)

| Item | Descrição |
|---|---|
| Perfil | 27 anos, barbeiro autônomo em estúdio compartilhado, Lages/SC |
| Tecnologia | Alta: usa vários apps e atalhos |
| Perfil de adoção | Early adopter, impaciente com interfaces lentas |
| **Dor principal** | Muitas mensagens de WhatsApp e agenda espalhada; não consegue ver os horários livres rapidamente |
| **Cenário de uso** | Entre um corte e outro, consulta os horários livres do dia para responder um cliente |
| **Métrica de sucesso** | Responder um cliente com horários disponíveis em menos de 10 s |

#### Persona 3: Neusa Bittencourt (secundária, relutante)

| Item | Descrição |
|---|---|
| Perfil | 45 anos, manicure e dona de salão pequeno, Lages/SC, 20 anos de profissão |
| Tecnologia | Básica: usa WhatsApp, mas tem pouca prática com formulários e sistemas |
| Perfil de adoção | Relutante: já perdeu dados em um app anterior e por isso confia mais no caderno |
| **Dor principal** | Perde horários por letra ilegível e rasuras no caderno; desconfia de sistemas que possam apagar dados |
| **Cenário de uso** | Ao fim do dia, passa a agenda do caderno para o sistema e confere o dia seguinte |
| **Métrica de sucesso** | Usar o sistema sozinha, sem ajuda, após 1 semana |

#### Comparativo

| Persona | Dor principal | Tecnologia | Métrica de sucesso |
|---|---|---|---|
| Mariana (primária) | Conflito de horários | Intermediária | 0 conflitos/semana |
| Rafael | Visualizar horários livres rápido | Alta | Resposta ao cliente em < 10 s |
| Neusa | Caderno ilegível e medo de tecnologia | Baixa | Uso autônomo em 1 semana |

**Persona primária escolhida:** Mariana, por concentrar a dor central do problema (conflito de horário) e representar o uso típico (celular, mãos ocupadas).

> **Cuidados com viés:** nomes, profissões e cidades foram revisados para evitar estereótipos. As três personas diferem em familiaridade tecnológica e atitude diante da mudança, e não são variações da mesma pessoa.

---

## 03 · Requisitos funcionais

| ID | Requisito | Persona | Prioridade |
|---|---|---|---|
| RF01 | Cadastrar serviço com nome, duração (min) e preço (R$). | Mariana | Must |
| RF02 | Listar todos os serviços cadastrados. | Mariana, Neusa | Must |
| RF03 | Editar e excluir serviço existente. | Mariana | Must |
| RF04 | Cadastrar agendamento vinculado a um serviço, com nome e telefone da cliente, data e hora. | Mariana, Neusa | Must |
| RF05 | Impedir agendamento que conflite com outro no mesmo horário, considerando a duração do serviço. | Mariana | Must |
| RF06 | Consultar agendamentos por data, indicando horários ocupados e livres. | Rafael, Mariana | Must |
| RF07 | Editar, cancelar e marcar como "não compareceu" um agendamento. | Mariana | Should |
| RF08 | Validar formulários (campos obrigatórios e formatos). | Neusa, Mariana | Must |
| RF09 | Persistir todos os dados em banco remoto. | Mariana | Must |

---

## 04 · Requisitos não funcionais

| ID | Requisito | Métrica / como medir |
|---|---|---|
| RNF01 | Interface responsiva, mobile-first. | Sem rolagem horizontal a partir de 320 px (testar em 320, 375 e 1280 px). |
| RNF02 | Desempenho. | Meta do curso: carregamento inicial < 2 s em 4G. Limite aceitável: LCP ≤ 2,5 s (Lighthouse/DevTools com throttling de 4G). |
| RNF03 | Acessibilidade e usabilidade. | Contraste ≥ 4,5:1 para texto normal e ≥ 3:1 para texto grande (WCAG 1.4.3 AA); alvos de toque ≥ 24×24 px (WCAG 2.5.8 AA), com meta de 44×44 px; formulários operáveis por teclado; Lighthouse Accessibility ≥ 90. |
| RNF04 | Disponibilidade. | ≥ 99 % em horário comercial (seg–sáb, 8h–20h), conforme SLA do provedor. |
| RNF05 | Segurança e proteção de dados pessoais (LGPD). | Credenciais/chaves fora do client (revisar o bundle); HTTPS obrigatório; coleta mínima: apenas nome e telefone da cliente (LGPD art. 6º, III e VII). |
| RNF06 | Transparência e exposição reduzida (mitiga a ausência de login). | Aviso curto de privacidade visível no formulário de agendamento (LGPD art. 6º, I e art. 9º); páginas com `noindex` para não aparecerem em buscadores. |

---

## 05 · Histórias de usuário

### US-01 · Cadastrar serviço
**Como** proprietária do salão (Mariana), **quero** cadastrar um serviço com nome, duração e preço, **para** poder agendá-lo para as clientes.
**Prioridade:** MUST · **Estimativa:** 2 pts · **Depende de:** —

### US-02 · Registrar agendamento
**Como** proprietária, **quero** registrar um agendamento escolhendo cliente, serviço, data e hora pelo celular, **para** substituir o caderno e o WhatsApp.
**Prioridade:** MUST · **Estimativa:** 5 pts · **Depende de:** US-01

### US-03 · Evitar conflitos de horário
**Como** proprietária, **quero** ser avisada quando um horário já está ocupado, **para** não marcar duas clientes ao mesmo tempo.
**Prioridade:** MUST · **Estimativa:** 3 pts · **Depende de:** US-02

### US-04 · Consultar a agenda do dia
**Como** barbeiro/proprietária (Rafael, Mariana), **quero** ver os agendamentos e horários livres de uma data, **para** responder rapidamente a um cliente.
**Prioridade:** MUST · **Estimativa:** 3 pts · **Depende de:** US-02

### US-05 · Cancelar e registrar não comparecimento
**Como** proprietária, **quero** cancelar um agendamento ou marcá-lo como "não compareceu", **para** liberar o horário e acompanhar os no-shows.
**Prioridade:** SHOULD · **Estimativa:** 2 pts · **Depende de:** US-02

> **Priorização MoSCoW:** Must (US-01, US-02, US-03, US-04), Should (US-05), Won't (ver seção 07).
> **Atenção:** os Musts somam 13 de 15 pontos (≈ 87 %), acima da referência de ≤ 60 % de esforço Must do DSDM. Justificativa: o MVP é pequeno e Must = subconjunto mínimo utilizável (sem agendar, evitar conflito e consultar a agenda, o sistema não substitui o caderno). Se o prazo apertar, cortar primeiro o AC4 da US-03 e a US-05.
> **Qualidade (INVEST):** ver verificação na seção de validação humana.

---

## 06 · Critérios de aceite

**US-01 · Cadastrar serviço**
- [ ] AC1. Nome obrigatório (≥ 3 caracteres), duração entre 10 e 480 min, preço > R$ 0.
- [ ] AC2. Duração aceita apenas inteiros positivos.
- [ ] AC3. Preço é formatado em R$ ao digitar (ex.: R$ 1.250,00).
- [ ] AC4. Após salvar, o serviço aparece na lista em < 1 s.
- [ ] AC5. Cancelar descarta os dados sem persistência parcial.
- [ ] AC6. Em erro de rede, exibe mensagem amigável e mantém os dados digitados.

**US-02 · Registrar agendamento**
- [ ] AC1. Campos obrigatórios: nome da cliente, telefone válido, serviço, data e hora.
- [ ] AC2. Não permite agendar em data/hora passada.
- [ ] AC3. O formulário é utilizável em tela de 320 px e o registro leva < 30 s.
- [ ] AC4. Após salvar, o agendamento aparece na agenda da data escolhida.

**US-03 · Evitar conflitos de horário**
- [ ] AC1. Se o novo agendamento sobrepõe outro (considerando a duração), o sistema bloqueia e informa o horário em conflito.
- [ ] AC2. Agendamentos consecutivos (um termina quando o outro começa) são permitidos.
- [ ] AC3. Agendamentos cancelados não geram conflito.
- [ ] AC4. A mensagem sugere os próximos horários livres.

**US-04 · Consultar a agenda do dia**
- [ ] AC1. A agenda exibe, ordenados por hora, cliente, serviço e status do dia selecionado.
- [ ] AC2. Horários livres e ocupados são visualmente distintos (não apenas por cor).
- [ ] AC3. Dia sem agendamentos exibe estado vazio claro.
- [ ] AC4. Trocar de data atualiza a lista em < 1 s.

**US-05 · Cancelar e registrar não comparecimento**
- [ ] AC1. Cancelar exige confirmação e libera o horário para novos agendamentos.
- [ ] AC2. Marcar "não compareceu" mantém o registro no histórico, com status visível.
- [ ] AC3. Agendamentos já cancelados não podem ser cancelados nem marcados como no-show de novo.
- [ ] AC4. Em erro de rede, o status anterior é mantido e a mensagem informa a falha.

---

## 07 · Fora de escopo (MVP)

- Login, perfis de usuário e permissões. O MVP é de uso interno e sem autenticação; o **risco** (qualquer pessoa com o link acessa a agenda) está **aceito e documentado**.
- Agendamento online feito pela própria cliente.
- Notificações e lembretes por WhatsApp, SMS ou e-mail.
- Pagamentos, sinal e emissão de nota fiscal.
- Funcionamento offline com sincronização posterior.
- Múltiplos profissionais, comissões, estoque e relatórios financeiros.
- Aplicativo nativo (apenas web responsivo).

---

## Validação humana

Checklist do exercício aplicado ao documento. Resultado: ✅ atendido · ⚠️ atendido com ressalva · ⏳ depende de pessoas reais.

### 1. Cruzamento (RF ↔ persona, RNF mensurável)

**Rastreabilidade RF × Persona × História**

| RF | Mariana | Rafael | Neusa | História |
|---|:-:|:-:|:-:|---|
| RF01 Cadastrar serviço | ✔ | | | US-01 |
| RF02 Listar serviços | ✔ | | ✔ | US-01 |
| RF03 Editar/excluir serviço | ✔ | | | US-01 |
| RF04 Cadastrar agendamento | ✔ | | ✔ | US-02 |
| RF05 Impedir conflito | ✔ | | | US-03 |
| RF06 Consultar por data | ✔ | ✔ | | US-04 |
| RF07 Cancelar / no-show | ✔ | | | US-05 |
| RF08 Validar formulários | ✔ | | ✔ | US-01, US-02 |
| RF09 Persistir em banco remoto | ✔ | | | todas |

**Mensurabilidade dos RNFs**

| RNF | Mensurável? | Ferramenta de verificação |
|---|---|---|
| RNF01 | ✅ largura mínima 320 px | DevTools (modo responsivo) |
| RNF02 | ✅ LCP ≤ 2,5 s; meta < 2 s | Lighthouse / DevTools |
| RNF03 | ✅ contraste, alvo de toque, nota a11y | Lighthouse, axe, checagem manual por teclado |
| RNF04 | ✅ ≥ 99 % | SLA/painel do provedor |
| RNF05 | ✅ auditoria de bundle, HTTPS, campos coletados | Inspeção do build e do formulário |
| RNF06 | ✅ presença do aviso e da meta `noindex` | Inspeção do HTML |

**Resultado:** ✅ todo RF tem ao menos uma persona e uma história; todo RNF tem métrica e forma de teste.

### 2. Viés e invenções da IA

| Verificação | Resultado |
|---|---|
| Existem APIs, bibliotecas ou padrões citados no documento? | ✅ O documento **não prescreve stack** (sem bibliotecas nem APIs). Os únicos padrões citados são WCAG 2.2, LGPD, Lighthouse, INVEST e MoSCoW, todos conferidos em fontes oficiais (ver Referências). |
| Números sugeridos pela IA têm base? | ⚠️ Alvos de 320 px, 4,5:1, 24 px, 90 e 2,5 s foram **confirmados** nas fontes. Já a duração de serviço de 10 a 480 min, o horário seg–sáb 8h–20h e o SLA de 99 % são **suposições de negócio** a confirmar com a proprietária. |
| Estereótipos nas personas | ⚠️ A revisão encontrou risco na persona Neusa (mulher mais velha ligada a baixa tecnologia). **Corrigido:** idade 45 e a relutância passou a vir de experiência ruim anterior, não da idade. As 3 personas diferem em perfil de adoção, e não são variações da mesma pessoa. |
| Entrevista simulada é evidência? | ⚠️ Não. A avaliação do Nielsen Norman Group sobre usuários sintéticos (ver Referências) concluiu que as respostas são rasas demais para decidir o que usuários precisam. Por isso todo conteúdo da seção 02 é tratado como **hipótese**. |
| Prioridade (MoSCoW) coerente com o conceito? | ⚠️ O RF06 era Must e a US-04 era Should; **corrigido** (US-04 virou Must). Os Musts somam ≈ 87 % dos pontos, acima da referência de 60 % do DSDM, e a justificativa está na seção 05. |

### 3. Clareza (leitura em 5 minutos)

- ✅ O "Resumo em 5 minutos" no início permite entender problema, solução, persona, escopo e fora de escopo em cerca de 1 minuto.
- ✅ IDs padronizados (RF, RNF, US, AC) e tabelas, sem jargão não explicado.
- ✅ Histórias seguem o formato canônico "Como <papel>, quero <ação>, para <valor>".
- ⏳ **Teste real:** pedir a um colega que não conhece o projeto para ler em 5 minutos e explicar o que o sistema faz.

**Verificação INVEST (Bill Wake)**

| História | I | N | V | E | S | T | Observação |
|---|:-:|:-:|:-:|:-:|:-:|:-:|---|
| US-01 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Independente |
| US-02 | ⚠️ | ✅ | ✅ | ✅ | ✅ | ✅ | Depende de US-01 (serviço precisa existir) |
| US-03 | ⚠️ | ✅ | ✅ | ✅ | ✅ | ✅ | Depende de US-02 |
| US-04 | ⚠️ | ✅ | ✅ | ✅ | ✅ | ✅ | Depende de US-02 |
| US-05 | ⚠️ | ✅ | ✅ | ✅ | ✅ | ✅ | Depende de US-02 |

As dependências são naturais em um CRUD e estão explícitas em cada história. Todas têm 3 ou mais ACs testáveis.

### 4. Segurança e LGPD

| Ponto | Avaliação | Base |
|---|---|---|
| Nome e telefone da cliente são dado pessoal | ✅ Reconhecido. O sistema trata dado pessoal, ainda que não sensível. | LGPD art. 5º, I |
| Minimização | ✅ RNF05 limita a coleta a nome e telefone, sem CPF, endereço ou saúde. | LGPD art. 6º, III (necessidade) |
| Medidas de segurança | ⚠️ HTTPS e chaves fora do client estão cobertos. Porém **sem login, qualquer pessoa com o link vê nomes e telefones**. Mitigação no MVP: link não divulgado e `noindex` (RNF06). **Risco aceito e documentado**; um acesso mínimo protegido é prioridade na versão seguinte. | LGPD art. 6º, VII e art. 46 |
| Transparência | ✅ RNF06 exige aviso curto de privacidade. | LGPD art. 6º, I e art. 9º |
| Base legal | ⏳ Hipótese: legítimo interesse ou execução de contrato (art. 7º). Precisa ser confirmada pelo salão (o controlador). Não é parecer jurídico. | LGPD art. 7º, IX e art. 10 |

### 5. Pendências que dependem de pessoas

- [ ] Entrevistar de 3 a 5 pessoas reais (donas ou profissionais de salão) e ajustar personas e dores.
- [ ] Confirmar as suposições de negócio (duração, horário, SLA).
- [ ] Revisão do professor e de colegas ("quem valida o validador?").
- [ ] Teste de leitura de 5 minutos com alguém de fora.

### 6. Registro da revisão (alterações feitas após a validação)

| # | Problema encontrado | Correção |
|---|---|---|
| 1 | RF06 (Must) e US-04 (Should) incoerentes | US-04 passou a Must |
| 2 | RNF03 pedia alvo de 44 px como requisito. O critério AA do WCAG 2.2 exige 24 px; 44 px é o critério avançado. | Mínimo 24 px (AA) e meta de 44 px |
| 3 | RNF02 com limite diferente do "bom" do LCP (2,5 s) | Mantida a meta de < 2 s do curso e incluído o limite de LCP ≤ 2,5 s |
| 4 | Sem proteção compensatória à ausência de login e sem transparência LGPD | Criado o RNF06 (aviso de privacidade e `noindex`) |
| 5 | RF07 sem história própria | Criada a US-05 com ACs |
| 6 | Persona Neusa com viés de idade | Persona revisada (45 anos, relutância por experiência prévia) |
| 7 | Musts acima de 60 % do esforço | Mantido e justificado na seção 05 |

**Decisões e hipóteses em aberto**
- "Sem login" no MVP versus segurança: fora de escopo, com risco aceito e mitigação parcial.
- Persistência offline removida do MVP por complexidade.
- Duração mínima/máxima de serviço e horário de funcionamento são suposições a confirmar.

---

## Referências

1. W3C. *Understanding SC 1.4.3: Contrast (Minimum)* (WCAG 2.2). Texto normal ≥ 4,5:1, texto grande ≥ 3:1. https://w3c.github.io/wcag/understanding/contrast-minimum.html
2. W3C. *Understanding SC 2.5.8: Target Size (Minimum)* (WCAG 2.2, nível AA). Alvos de pelo menos 24×24 px CSS; menciona o 2.5.5 (44×44 px). https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html
3. Brasil. *Lei nº 13.709/2018 (LGPD)*, arts. 5º I, 6º I/III/VII, 7º IX, 9º, 10 e 46 (texto compilado). https://www.tce.rn.gov.br/as/Ouvidoria/Legislação/Lei_137092018_compilado_LGPD.pdf
4. Google Chrome Team. *Lighthouse scoring*: faixa 90–100 é considerada boa. https://github.com/GoogleChrome/lighthouse/blob/d2ec9ffbb21de9ad1a0f86ed24575eda32c796f0/docs/scoring.md
5. web.dev. *Largest Contentful Paint (LCP)*: bom ≤ 2,5 s no percentil 75. https://web.dev/articles/lcp
6. Agile Business Consortium. *DSDM / MoSCoW*: definições de Must, Should, Could e Won't, e referência de ≤ 60 % de esforço Must. https://www.agilebusiness.org/?p=1907
7. Agile Business Consortium. *Requirements and user stories*: critérios INVEST (Bill Wake). https://www.agilebusiness.org/page/ProjectFramework_15_RequirementsandUserStories
8. Nielsen Norman Group, resumo em ZURB Radar: *Synthetic users were too shallow to be useful against three real studies*. https://radar.zurb.com/article/nielsen-norman-synthetic-users-were-too-shallow-to-be-useful-against-three-real-studies
9. Material da aula: *Aula 01 · Descoberta de Requisitos* (formato canônico de história, CTQF, checklist de validação, recomendação de 3–5 entrevistas reais).

> Observação: a página do Nielsen Norman Group sobre "testar com 5 usuários" não pôde ser lida durante a pesquisa (limite de acesso). Por isso a recomendação de 3–5 entrevistas se apoia no material da aula.

---

## Apêndice · Prompts utilizados

Estrutura **CTQF** (Contexto, Tarefa, Quem, Formato).

**Entrevista simulada**
```
# CONTEXTO
Estou especificando um MVP de sistema web de agendamento para o Salão Serena, em Lages/SC. Hoje a agenda é feita por WhatsApp e caderno de papel, com conflitos de horário e no-shows.
# TAREFA
Responda como Mariana, 32, cabeleireira e proprietária, em uma entrevista de descoberta. Responda como a persona, não como IA. Conte episódios concretos. Ao final, liste suas dores em ordem de importância.
# QUEM
Você é Mariana, cabeleireira, tecnologia intermediária, sempre atendendo com as mãos ocupadas.
# FORMATO
Diálogo curto (Você / Mariana), perguntas abertas, 10 min de conversa simulada.
```

**Personas**
```
# CONTEXTO
MVP de sistema web de agendamento de serviços para pequenos negócios (salões, barbearias, clínicas). Brasil, português, Lages/SC.
# TAREFA
Gere 3 personas distintas (diversidade técnica e contextual: early adopter, intermediária, relutante). Para cada uma: nome fictício, idade, profissão, cidade, principal dor, familiaridade com tecnologia, cenário de uso e 1 métrica de sucesso.
# QUEM
Você é uma pesquisadora de UX sênior com experiência em design de serviços para pequenos negócios.
# FORMATO
Markdown, 1 bloco por persona, separados por ---, com tabela comparativa no final.
```

**Requisitos e histórias**
```
# CONTEXTO
Sistema web Serena Agenda, mobile-first, sem login no MVP, CRUD de serviços e agendamentos com persistência remota. Persona primária: Mariana.
# TAREFA
Liste 6 a 10 requisitos funcionais (RF01...) e 4 a 6 não funcionais mensuráveis (RNF01...). Depois escreva histórias no formato "Como <papel>, quero <ação>, para <valor>", com 3+ critérios de aceite testáveis cada e prioridade MoSCoW.
# QUEM
Você é um analista de requisitos sênior.
# FORMATO
Markdown com tabelas (requisitos) e checklists (critérios de aceite).
```
