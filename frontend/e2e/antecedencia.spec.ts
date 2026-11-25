// Aula 05 · limite de antecedência: até quantos dias à frente se pode agendar (padrão 30, configurável).
import { expect, test } from '@playwright/test';
import { addDias, iso } from '../src/lib/horarios';
import { criarAgendamentoPelaTela, proximoDiaAberto, resetarBanco, sql } from './support/helpers';

test.beforeEach(async () => resetarBanco());

test('ANT-01 · o seletor de data não passa de hoje + 30 dias', async ({ page }) => {
  await page.goto('/agenda/novo');
  await expect(page.getByLabel('Data')).toHaveAttribute('max', iso(addDias(new Date(), 30)));
});

test('ANT-02 · data além do limite é recusada com mensagem clara e nada é gravado', async ({ page }) => {
  await criarAgendamentoPelaTela(page, { cliente: 'Ana Lima', data: iso(addDias(new Date(), 40)), hora: '10:00' });
  await expect(page.getByText('Só é possível agendar até 30 dias à frente.')).toBeVisible();
  expect(await sql('select 1 from agendamentos')).toHaveLength(0);
});

test('ANT-03 · a dona aumenta o limite na tela Horários e o agendamento distante passa a ser aceito', async ({ page }) => {
  await page.goto('/horarios');
  await page.getByLabel('Dias à frente').fill('60');
  await page.getByRole('button', { name: 'Salvar antecedência' }).click();
  await expect(page.getByText('Antecedência salva.')).toBeVisible();
  expect(await sql('select antecedencia_max_dias from configuracao')).toEqual([{ antecedencia_max_dias: 60 }]);

  const dia = proximoDiaAberto(45);
  await criarAgendamentoPelaTela(page, { cliente: 'Ana Lima', data: dia, hora: '10:00' });
  await expect(page.getByText('Agendamento salvo.')).toBeVisible();
  expect(await sql('select data::text as data from agendamentos')).toEqual([{ data: dia }]);
});

test('ANT-04 · valor inválido na configuração é recusado', async ({ page }) => {
  await page.goto('/horarios');
  await page.getByLabel('Dias à frente').fill('0');
  await page.getByRole('button', { name: 'Salvar antecedência' }).click();
  await expect(page.getByText('Informe um número de dias entre 1 e 365.')).toBeVisible();
  expect(await sql('select antecedencia_max_dias from configuracao')).toEqual([{ antecedencia_max_dias: 30 }]);
});
