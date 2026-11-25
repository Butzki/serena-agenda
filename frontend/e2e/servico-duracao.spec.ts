// BUG-03 · Editar a duração de um serviço pode sobrepor agendamentos já marcados.
// O trigger do banco só roda em `agendamentos`; mudar `servicos.duracao_min`
// muda retroativamente o fim de todo agendamento daquele serviço.
import { expect, test } from '@playwright/test';
import { agendarNoBanco, proximoDiaAberto, resetarBanco, sql } from './support/helpers';

test.beforeEach(async () => resetarBanco());

test('BUG-03 · aumentar duração que causa sobreposição pede confirmação e lista os conflitos', async ({ page }) => {
  const dia = proximoDiaAberto(1);
  await agendarNoBanco('Ana Lima', 'Escova', dia, '14:00'); // 14:00–14:30
  await agendarNoBanco('Bia Souza', 'Manicure', dia, '14:30'); // 14:30–15:10

  await page.goto('/servicos');
  await page.getByRole('link', { name: 'Editar Escova' }).click();
  await page.getByLabel('Duração (min)').fill('60'); // Escova passaria a ir até 15:00
  await page.getByRole('button', { name: 'Salvar serviço' }).click();

  const dialogo = page.getByRole('dialog');
  await expect(dialogo).toContainText('vão se sobrepor');
  await expect(dialogo).toContainText('Ana Lima');
  await page.getByRole('button', { name: 'Voltar' }).click();
  expect(await sql(`select duracao_min from servicos where nome = 'Escova'`)).toEqual([{ duracao_min: 30 }]);
});

test('BUG-03 · aumentar duração sem conflito salva direto', async ({ page }) => {
  const dia = proximoDiaAberto(1);
  await agendarNoBanco('Ana Lima', 'Escova', dia, '14:00');
  await page.goto('/servicos');
  await page.getByRole('link', { name: 'Editar Escova' }).click();
  await page.getByLabel('Duração (min)').fill('45');
  await page.getByRole('button', { name: 'Salvar serviço' }).click();
  await expect(page.getByRole('status')).toHaveText('Serviço salvo.');
});
