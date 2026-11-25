// US-05 · Cancelar e registrar "não compareceu" + regressões dos bugs da Aula 05.
// Os testes marcados BUG-xx falhavam ANTES da correção (ver docs/05-testes-validacao.md § 6).
import { expect, test } from '@playwright/test';
import { agendarNoBanco, proximoDiaAberto, resetarBanco, sql } from './support/helpers';

test.beforeEach(async () => resetarBanco());

test('US05-01 · AC1 · cancelar exige confirmação e libera o horário', async ({ page }) => {
  const dia = proximoDiaAberto(1);
  await agendarNoBanco('Ana Lima', 'Corte feminino', dia, '14:00');
  await page.goto(`/agenda?data=${dia}`);
  await page.getByRole('button', { name: 'Cancelar agendamento de Ana Lima' }).click();
  await expect(page.getByRole('dialog')).toContainText('Cancelar agendamento?');
  await page.getByRole('button', { name: 'Voltar' }).click();
  expect(await sql(`select status from agendamentos`)).toEqual([{ status: 'ativo' }]);

  await page.getByRole('button', { name: 'Cancelar agendamento de Ana Lima' }).click();
  await page.getByRole('button', { name: 'Sim, cancelar' }).click();
  await expect(page.getByText('✕ Cancelado')).toBeVisible();
  await expect(page.getByText(/Livre das 08:00 às 20:00/)).toBeVisible();
});

test('US05-02 · AC2/AC3 · "não compareceu" fica no histórico e cancelado não tem mais ações', async ({ page }) => {
  const dia = proximoDiaAberto(1);
  await agendarNoBanco('Ana Lima', 'Corte feminino', dia, '14:00');
  await agendarNoBanco('Bia Souza', 'Escova', dia, '16:00', 'cancelado');
  await page.goto(`/agenda?data=${dia}`);
  await page.getByRole('button', { name: 'Marcar Ana Lima como não compareceu' }).click();
  await expect(page.getByText('! Não compareceu')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Cancelar agendamento de Bia Souza' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Marcar Bia Souza como não compareceu' })).toHaveCount(0);
});

test('BUG-01 · AC4 · erro ao cancelar mostra mensagem (antes falhava em silêncio)', async ({ page }) => {
  const dia = proximoDiaAberto(1);
  await agendarNoBanco('Ana Lima', 'Corte feminino', dia, '14:00');
  await page.goto(`/agenda?data=${dia}`);
  await page.route('**/rest/v1/agendamentos*', (r) => (r.request().method() === 'PATCH' ? r.abort('internetdisconnected') : r.continue()));
  await page.getByRole('button', { name: 'Cancelar agendamento de Ana Lima' }).click();
  await page.getByRole('button', { name: 'Sim, cancelar' }).click();
  await expect(page.getByRole('alert')).toContainText('Não foi possível cancelar');
  await expect(page.getByText('● Ocupado')).toBeVisible(); // status anterior mantido
});

test('BUG-01 · desfazer "não compareceu" num horário já reocupado explica o motivo', async ({ page }) => {
  const dia = proximoDiaAberto(1);
  await agendarNoBanco('Ana Lima', 'Corte feminino', dia, '14:00', 'noshow');
  await agendarNoBanco('Bia Souza', 'Escova', dia, '14:00'); // horário foi reaproveitado
  await page.goto(`/agenda?data=${dia}`);
  await page.getByRole('button', { name: 'Desfazer "não compareceu" de Ana Lima' }).click();
  await expect(page.getByRole('alert')).toContainText('Conflito de horário');
  expect(await sql(`select status from agendamentos where cliente_nome = 'Ana Lima'`)).toEqual([{ status: 'noshow' }]);
});

test('US05-03 · "não compareceu" mantém o horário como PERDIDO na agenda (não vira janela livre)', async ({ page }) => {
  // Decisão de produto (Aula 05, revisão do BUG-02): o no-show só acontece depois que o horário
  // passou, então a dona precisa ver que o horário se perdeu, e não uma janela livre.
  const dia = proximoDiaAberto(1);
  await agendarNoBanco('Ana Lima', 'Corte feminino', dia, '14:00', 'noshow');
  await page.goto(`/agenda?data=${dia}`);
  await expect(page.getByText(/Livre das 08:00 às 14:00/)).toBeVisible();
  await expect(page.getByText(/Livre das 15:00 às 20:00/)).toBeVisible();
  await expect(page.getByText(/Livre das 08:00 às 20:00/)).toHaveCount(0);
  const resumo = page.getByRole('group', { name: 'Resumo do dia' });
  await expect(resumo).toContainText('0ocupados');
  await expect(resumo).toContainText('1horário perdido');
});
