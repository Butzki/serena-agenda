// Teste de integração ponta a ponta: front → API (REST do Supabase) → banco
// (schema real, com trigger) → volta para a tela. Cobre US-02, US-03 e US-04.
import { expect, test } from '@playwright/test';
import { agendarNoBanco, criarAgendamentoPelaTela, criarServicoPelaTela, proximoDiaAberto, proximoDomingo, resetarBanco, sql } from './support/helpers';

test.beforeEach(async () => resetarBanco());

test('E2E-01 · fluxo completo: cadastrar serviço → agendar → ver na agenda', async ({ page }) => {
  const dia = proximoDiaAberto(1);

  // 1. Cadastrar serviço (RF01)
  await criarServicoPelaTela(page, 'Escova modelada', '45', '7000');
  await expect(page.getByRole('list', { name: 'Serviços cadastrados' })).toContainText('Escova modelada');

  // 2. Criar agendamento (RF04) — cronometrado: US-02 AC3 pede registro em < 30 s
  const inicio = Date.now();
  await criarAgendamentoPelaTela(page, { cliente: 'Ana Lima', servico: 'Escova modelada · 45 min', data: dia, hora: '14:00' });

  // 3. Agenda do dia mostra o agendamento (RF06, US-02 AC4)
  await expect(page).toHaveURL(new RegExp(`/agenda\\?data=${dia}`));
  await expect(page.getByRole('status')).toHaveText('Agendamento salvo.');
  const agenda = page.getByRole('list', { name: 'Agenda do dia' });
  await expect(agenda).toContainText('Ana Lima');
  await expect(agenda).toContainText('Escova modelada · 45 min');
  await expect(agenda).toContainText('● Ocupado');
  test.info().annotations.push({ type: 'tempo-registro', description: `${Date.now() - inicio} ms (automatizado)` });

  // 4. Persistência no banco remoto (RF09)
  const linhas = await sql(`select a.cliente_nome, a.hora::text, s.nome from agendamentos a join servicos s on s.id = a.servico_id`);
  expect(linhas).toEqual([{ cliente_nome: 'Ana Lima', hora: '14:00:00', nome: 'Escova modelada' }]);
});

test('E2E-02 · US-03 AC1/AC4 · conflito é bloqueado e sugere horários livres', async ({ page }) => {
  const dia = proximoDiaAberto(1);
  await agendarNoBanco('Ana Lima', 'Corte feminino', dia, '14:00');

  await criarAgendamentoPelaTela(page, { cliente: 'Bia Souza', servico: 'Escova · 30 min', data: dia, hora: '14:30' });
  const alerta = page.getByRole('alert');
  await expect(alerta).toContainText('Horário indisponível');
  await expect(alerta).toContainText('Ana Lima já está agendada às 14:00');
  const sugestoes = page.getByRole('group', { name: 'Horários livres sugeridos' });
  await expect(sugestoes.getByRole('button')).toHaveText(['15:00', '15:30', '16:00']);

  await sugestoes.getByRole('button', { name: '15:00' }).click();
  await expect(page.getByLabel('Hora')).toHaveValue('15:00');
  await page.getByRole('button', { name: 'Salvar agendamento' }).click();
  await expect(page.getByRole('list', { name: 'Agenda do dia' })).toContainText('Bia Souza');
});

test('E2E-03 · US-03 AC2 · agendamento consecutivo é permitido', async ({ page }) => {
  const dia = proximoDiaAberto(1);
  await agendarNoBanco('Ana Lima', 'Corte feminino', dia, '14:00'); // até 15:00
  await criarAgendamentoPelaTela(page, { cliente: 'Bia Souza', servico: 'Escova · 30 min', data: dia, hora: '15:00' });
  await expect(page.getByRole('status')).toHaveText('Agendamento salvo.');
});

test('E2E-04 · US-03 · corrida entre duas abas: o banco (trigger) barra e a tela explica', async ({ page }) => {
  const dia = proximoDiaAberto(1);
  await page.goto(`/agenda/novo?data=${dia}`);
  await page.getByLabel('Nome da cliente').fill('Bia Souza');
  await page.getByLabel('Telefone (WhatsApp)').fill('49999990001');
  await page.getByLabel('Data').fill(dia);
  await page.getByLabel('Hora').fill('10:00');
  // Outra pessoa grava no mesmo horário DEPOIS que a tela consultou os conflitos:
  // simulamos isso gravando no banco no instante em que o insert sai do navegador.
  await page.route('**/rest/v1/agendamentos*', async (r) => {
    if (r.request().method() === 'POST') await agendarNoBanco('Carla Dias', 'Escova', dia, '10:00');
    await r.continue();
  });
  await page.getByRole('button', { name: 'Salvar agendamento' }).click();
  await expect(page.getByRole('alert')).toContainText('Conflito de horário');
  expect(await sql(`select cliente_nome from agendamentos`)).toEqual([{ cliente_nome: 'Carla Dias' }]);
});

test('E2E-05 · US-02 AC1/AC2 · campos obrigatórios e data/hora passada', async ({ page }) => {
  await page.goto('/agenda/novo');
  await page.getByLabel('Hora').fill('');
  await page.getByRole('button', { name: 'Salvar agendamento' }).click();
  await expect(page.getByText('Informe o nome da cliente (mínimo 3 letras).')).toBeVisible();
  await expect(page.getByText('Informe um telefone válido com DDD.')).toBeVisible();
  await expect(page.getByText('Escolha a hora.')).toBeVisible();

  await page.getByLabel('Nome da cliente').fill('Ana Lima');
  await page.getByLabel('Telefone (WhatsApp)').fill('49999990000');
  await page.getByLabel('Data').fill('2020-01-02');
  await page.getByLabel('Hora').fill('10:00');
  await page.getByRole('button', { name: 'Salvar agendamento' }).click();
  await expect(page.getByText('Não é possível agendar em horário que já passou.')).toBeVisible();
  expect(await sql('select 1 from agendamentos')).toHaveLength(0);
});

test('E2E-06 · calendário · domingo e feriado bloqueiam no formulário e na agenda', async ({ page }) => {
  const domingo = proximoDomingo();
  await page.goto(`/agenda?data=${domingo}`);
  await expect(page.getByText('O salão não abre aos domingos.')).toBeVisible();
  await expect(page.getByRole('button', { name: '＋ Novo agendamento' })).toHaveCount(0);

  await page.goto(`/agenda?data=2026-12-25`);
  await expect(page.getByText(/Natal/)).toBeVisible();
});

test('E2E-07 · US-04 AC1/AC3/AC4 · agenda ordenada, estado vazio e troca de data rápida', async ({ page }) => {
  const dia = proximoDiaAberto(1);
  await agendarNoBanco('Bia Souza', 'Escova', dia, '16:00');
  await agendarNoBanco('Ana Lima', 'Corte feminino', dia, '09:00');
  await page.goto(`/agenda?data=${dia}`);
  const nomes = page.getByRole('list', { name: 'Agenda do dia' }).locator('p.font-bold');
  await expect(nomes).toHaveText(['Ana Lima', 'Bia Souza']);
  await expect(page.getByText(/Livre das 10:00 às 16:00/)).toBeVisible();

  const inicio = Date.now();
  await page.getByRole('link', { name: 'Próximo dia' }).click();
  await expect(page.getByText(/Nenhum agendamento neste dia|O salão não abre/)).toBeVisible();
  const ms = Date.now() - inicio;
  test.info().annotations.push({ type: 'tempo-troca-data', description: `${ms} ms` });
  expect(ms).toBeLessThan(1000);
});
