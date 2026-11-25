// RNF01 (responsivo, sem rolagem horizontal a partir de 320 px) e
// RNF03 (acessibilidade: axe-core, regras WCAG 2.x A/AA).
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { agendarNoBanco, proximoDiaAberto, resetarBanco } from './support/helpers';

const TELAS = ['/agenda', '/agenda/novo', '/servicos', '/servicos/novo', '/horarios'];
const LARGURAS = [320, 375, 768, 1280];

test.beforeAll(async () => {
  await resetarBanco();
  await agendarNoBanco('Ana Lima', 'Corte feminino', proximoDiaAberto(0) , '18:00').catch(() => undefined);
});

for (const largura of LARGURAS) {
  test(`RNF01 · sem rolagem horizontal em ${largura}px`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 800 });
    for (const tela of TELAS) {
      await page.goto(tela);
      await page.waitForLoadState('networkidle');
      const transborda = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(transborda, `${tela} transborda ${transborda}px em ${largura}px`).toBeLessThanOrEqual(0);
      if (largura === 375 || largura === 1280) {
        await page.screenshot({ path: `e2e-evidencias/${largura}${tela.replace(/\//g, '_')}.png`, fullPage: true });
      }
    }
  });
}

test('RNF03 · axe: nenhuma violação séria/crítica WCAG A/AA nas telas', async ({ page }) => {
  const achados: string[] = [];
  for (const tela of TELAS) {
    await page.goto(tela);
    await page.waitForLoadState('networkidle');
    const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
    for (const v of r.violations) achados.push(`${tela} · ${v.impact} · ${v.id} (${v.nodes.length}x): ${v.help}`);
  }
  test.info().annotations.push({ type: 'axe', description: achados.join('\n') || 'nenhuma violação' });
  console.log(achados.join('\n') || 'axe: nenhuma violação');
  expect(achados.filter((a) => / · (serious|critical) · /.test(a))).toEqual([]);
});
