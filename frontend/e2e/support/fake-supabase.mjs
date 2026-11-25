// Banco de TESTE para os testes E2E (Aula 05): nunca o banco de produção.
//
// Sobe o schema.sql + seed.sql REAIS do projeto num Postgres em memória
// (PGlite, Postgres 16 compilado para WASM) e expõe a mesma API REST que o
// Supabase expõe em /rest/v1 (subconjunto do PostgREST usado pelo app).
// Assim o front conversa com constraints, trigger de conflito e RLS de
// verdade, sem Docker e sem conta, e cada teste começa com o banco limpo.
//
// Alternativa equivalente (mais pesada): `supabase start` (Supabase CLI +
// Docker) e apontar E2E_SUPABASE_URL para ele. Ver docs/05-testes-validacao.md.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../supabase');
const SCHEMA = fs.readFileSync(path.join(raiz, 'schema.sql'), 'utf8');
const SEED = fs.readFileSync(path.join(raiz, 'seed.sql'), 'utf8');

export async function criarBanco({ seed = true } = {}) {
  const db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(SCHEMA);
  if (seed) await db.exec(SEED);
  return db;
}

const ident = (s) => {
  if (!/^[a-z_][a-z0-9_]*$/.test(s)) throw Object.assign(new Error(`identificador inválido: ${s}`), { code: 'PGRST100' });
  return `"${s}"`;
};

// Embeds conhecidos do app: alias:tabela(*) -> join pela FK.
const EMBEDS = { agendamentos: { servicos: 'servico_id' } };

function montarSelect(tabela, select) {
  const partes = [];
  let profundidade = 0;
  let atual = '';
  for (const ch of select || '*') {
    if (ch === '(') profundidade++;
    if (ch === ')') profundidade--;
    if (ch === ',' && profundidade === 0) {
      partes.push(atual.trim());
      atual = '';
    } else atual += ch;
  }
  if (atual.trim()) partes.push(atual.trim());
  return partes
    .map((p) => {
      const m = p.match(/^(?:(\w+):)?(\w+)\((.*)\)$/);
      if (m) {
        const [, alias, alvo] = m;
        const fk = EMBEDS[tabela]?.[alvo];
        if (!fk) throw Object.assign(new Error(`embed não suportado: ${p}`), { code: 'PGRST200' });
        return `(select row_to_json(e) from ${ident(alvo)} e where e.id = t.${ident(fk)}) as ${ident(alias || alvo)}`;
      }
      return p === '*' ? 't.*' : `t.${ident(p)}`;
    })
    .join(', ');
}

const OPS = { eq: '=', neq: '<>', gt: '>', gte: '>=', lt: '<', lte: '<=' };
const RESERVADOS = new Set(['select', 'order', 'on_conflict', 'columns', 'limit', 'offset']);

function montarWhere(params, valores) {
  const conds = [];
  for (const [col, bruto] of params) {
    if (RESERVADOS.has(col)) continue;
    const i = bruto.indexOf('.');
    const op = OPS[bruto.slice(0, i)];
    if (!op) throw Object.assign(new Error(`operador não suportado: ${bruto}`), { code: 'PGRST100' });
    valores.push(bruto.slice(i + 1));
    conds.push(`t.${ident(col)} ${op} $${valores.length}`);
  }
  return conds.length ? `where ${conds.join(' and ')}` : '';
}

function montarOrder(order) {
  if (!order) return '';
  return (
    'order by ' +
    order
      .split(',')
      .map((o) => {
        const [col, dir = 'asc'] = o.split('.');
        return `t.${ident(col)} ${dir === 'desc' ? 'desc' : 'asc'}`;
      })
      .join(', ')
  );
}

function erroPg(e) {
  const status = e.code === '23505' ? 409 : e.code?.startsWith('PGRST') ? 400 : 400;
  return { status, body: { code: e.code ?? 'XX000', message: e.message, details: e.detail ?? null, hint: e.hint ?? null } };
}

export function criarServidor({ porta = 54321 } = {}) {
  let db;
  let pronto = criarBanco().then((d) => (db = d));

  const server = http.createServer(async (req, res) => {
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,HEAD,OPTIONS',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Expose-Headers': 'Content-Range',
    };
    const responder = (status, body, extra = {}) => {
      res.writeHead(status, { ...cors, 'Content-Type': 'application/json; charset=utf-8', ...extra });
      res.end(body === undefined || req.method === 'HEAD' ? undefined : JSON.stringify(body));
    };
    if (req.method === 'OPTIONS') return responder(204);

    const url = new URL(req.url, `http://localhost:${porta}`);
    let corpo = '';
    for await (const c of req) corpo += c;

    try {
      if (url.pathname === '/__reset') {
        pronto = criarBanco({ seed: url.searchParams.get('seed') !== '0' }).then((d) => (db = d));
        await pronto;
        return responder(200, { ok: true });
      }
      if (url.pathname === '/__sql') {
        await pronto;
        const r = await db.query(JSON.parse(corpo).sql);
        return responder(200, r.rows);
      }
      await pronto;

      const m = url.pathname.match(/^\/rest\/v1\/(\w+)$/);
      if (!m) return responder(404, { message: 'rota não encontrada' });
      const tabela = ident(m[1]);
      const params = [...url.searchParams.entries()];
      const prefer = req.headers.prefer || '';
      const valores = [];
      const where = montarWhere(params, valores);
      const representacao = prefer.includes('return=representation');
      let sql;
      let statusOk = 200;

      if (req.method === 'GET' || req.method === 'HEAD') {
        const sel = montarSelect(m[1], url.searchParams.get('select'));
        sql = `select ${sel} from ${tabela} t ${where} ${montarOrder(url.searchParams.get('order'))}`;
      } else if (req.method === 'POST') {
        const dados = JSON.parse(corpo || '[]');
        const linhas = Array.isArray(dados) ? dados : [dados];
        const cols = Object.keys(linhas[0] ?? {});
        const tuplas = linhas.map(
          (l) => `(${cols.map((c) => (valores.push(l[c] === null ? null : String(l[c])), `$${valores.length}`)).join(', ')})`
        );
        const conflito = url.searchParams.get('on_conflict');
        const upsert =
          conflito && prefer.includes('merge-duplicates')
            ? `on conflict (${conflito.split(',').map(ident).join(', ')}) do update set ${cols
                .filter((c) => !conflito.split(',').includes(c))
                .map((c) => `${ident(c)} = excluded.${ident(c)}`)
                .join(', ')}`
            : '';
        sql = `insert into ${tabela} as t (${cols.map(ident).join(', ')}) values ${tuplas.join(', ')} ${upsert} returning t.*`;
        statusOk = 201;
      } else if (req.method === 'PATCH') {
        // `where` já empilhou seus valores em $1..$n; os do SET vêm depois.
        const dados = JSON.parse(corpo || '{}');
        const sets = Object.keys(dados).map((c) => {
          valores.push(dados[c] === null ? null : String(dados[c]));
          return `${ident(c)} = $${valores.length}`;
        });
        sql = `update ${tabela} as t set ${sets.join(', ')} ${where} returning t.*`;
      } else if (req.method === 'DELETE') {
        sql = `delete from ${tabela} as t ${where} returning t.*`;
      } else {
        return responder(405, { message: 'método não suportado' });
      }

      const final = `with r as (${sql}) select coalesce(json_agg(r), '[]'::json) as body, count(*)::int as n from r`;
      const { rows } = await db.query(final, valores);
      const lista = rows[0].body;
      const total = rows[0].n;
      const extra = prefer.includes('count=') ? { 'Content-Range': `${total ? `0-${total - 1}` : '*'}/${total}` } : {};

      const leitura = req.method === 'GET' || req.method === 'HEAD';
      if (!leitura && !representacao) return responder(statusOk === 201 ? 201 : 204, undefined, extra);
      if ((req.headers.accept || '').includes('vnd.pgrst.object')) {
        if (lista.length !== 1)
          return responder(406, { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned', details: `${lista.length} rows`, hint: null });
        return responder(statusOk, lista[0], extra);
      }
      return responder(statusOk, lista, extra);
    } catch (e) {
      const { status, body } = erroPg(e);
      return responder(status, body);
    }
  });

  return {
    iniciar: () => new Promise((ok) => server.listen(porta, () => ok(server))),
    parar: () => new Promise((ok) => server.close(ok)),
  };
}

// Execução direta: `node e2e/support/fake-supabase.mjs` (usado pelo playwright.config.ts).
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const porta = Number(process.env.FAKE_SUPABASE_PORT || 54321);
  criarServidor({ porta })
    .iniciar()
    .then(() => console.log(`[fake-supabase] schema real em PGlite ouvindo em http://localhost:${porta}/rest/v1`));
}
