import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { useConfirmDialog } from '../components/ConfirmDialog';
import { supabase } from '../lib/supabase';
import {
  HORA_ABRE,
  HORA_FECHA,
  addDias,
  dataExtensa,
  duracaoOuPadrao,
  hhmm,
  iso,
  min,
  salaoFechado,
} from '../lib/horarios';
import type { AgendamentoComServico } from '../lib/types';

type Estado = 'loading' | 'success' | 'error';
type Item =
  | { tipo: 'livre'; t: number; de: number; ate: number }
  | { tipo: 'ag'; t: number; a: AgendamentoComServico };

export function AgendaPage() {
  const [params] = useSearchParams();
  const data = params.get('data') || iso(new Date());
  const { Dialog, confirmar } = useConfirmDialog();

  const [estado, setEstado] = useState<Estado>('loading');
  const [erro, setErro] = useState('');
  const [agendamentos, setAgendamentos] = useState<AgendamentoComServico[]>([]);

  const carregar = useCallback(async () => {
    setEstado('loading');
    const { data: linhas, error } = await supabase
      .from('agendamentos')
      .select('*, servico:servicos(*)')
      .eq('data', data)
      .order('hora');
    if (error) {
      setErro(error.message);
      setEstado('error');
      return;
    }
    setAgendamentos(linhas as unknown as AgendamentoComServico[]);
    setEstado('success');
  }, [data]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const ativos = agendamentos.filter((a) => a.status !== 'cancelado');
  const todos = agendamentos;
  const fechado = salaoFechado(data);

  const itens: Item[] = [];
  if (!fechado) {
    let cursor = HORA_ABRE;
    ativos.forEach((a) => {
      const ini = min(a.hora.slice(0, 5));
      if (ini - cursor >= 30) itens.push({ tipo: 'livre', t: cursor, de: cursor, ate: ini });
      cursor = Math.max(cursor, ini + duracaoOuPadrao(a));
    });
    if (HORA_FECHA - cursor >= 30) itens.push({ tipo: 'livre', t: cursor, de: cursor, ate: HORA_FECHA });
  }
  todos.forEach((a) => itens.push({ tipo: 'ag', t: min(a.hora.slice(0, 5)), a }));
  itens.sort((x, y) => x.t - y.t);

  const ext = dataExtensa(data);
  const dataAnterior = iso(addDias(new Date(data + 'T12:00'), -1));
  const dataProxima = iso(addDias(new Date(data + 'T12:00'), 1));

  async function cancelar(a: AgendamentoComServico) {
    const ok = await confirmar({
      titulo: 'Cancelar agendamento?',
      texto: `${a.cliente_nome} às ${a.hora.slice(0, 5)}. O horário ficará livre.`,
      rotuloOk: 'Sim, cancelar',
      perigo: true,
    });
    if (!ok) return;
    const { error } = await supabase.from('agendamentos').update({ status: 'cancelado' }).eq('id', a.id);
    if (error) return;
    carregar();
  }

  async function marcarNoShow(a: AgendamentoComServico) {
    const { error } = await supabase.from('agendamentos').update({ status: 'noshow' }).eq('id', a.id);
    if (error) return;
    carregar();
  }

  return (
    <Layout titulo="Agenda" marca>
      <div className="flex items-center gap-[var(--esp-2)] mt-[var(--esp-3)]">
        <Link
          to={`/agenda?data=${dataAnterior}`}
          aria-label="Dia anterior"
          className="min-w-[var(--alvo-toque)] min-h-[var(--alvo-toque)] inline-flex items-center justify-center bg-[var(--cor-superficie)] border border-[var(--cor-borda-campo)] rounded-[var(--raio-sm)] text-[length:var(--texto-lg)] no-underline text-[var(--cor-texto)]"
        >
          ‹
        </Link>
        <div className="flex-1 text-center" aria-live="polite">
          <strong className="block text-[length:var(--texto-lg)] capitalize">{ext.dia}</strong>
          <span className="text-[var(--cor-texto-suave)]">{ext.resto}</span>
        </div>
        <Link
          to={`/agenda?data=${dataProxima}`}
          aria-label="Próximo dia"
          className="min-w-[var(--alvo-toque)] min-h-[var(--alvo-toque)] inline-flex items-center justify-center bg-[var(--cor-superficie)] border border-[var(--cor-borda-campo)] rounded-[var(--raio-sm)] text-[length:var(--texto-lg)] no-underline text-[var(--cor-texto)]"
        >
          ›
        </Link>
      </div>

      {estado === 'loading' && <p className="text-[var(--cor-texto-suave)] text-center mt-[var(--esp-5)]">Carregando agenda…</p>}

      {estado === 'error' && (
        <Card borda="aviso" className="mt-[var(--esp-4)]">
          <p className="font-bold text-[var(--cor-perigo)]">Não foi possível carregar a agenda.</p>
          <p className="text-[length:var(--texto-sm)] text-[var(--cor-texto-suave)] mt-[var(--esp-1)]">{erro}</p>
          <Button pequeno className="mt-[var(--esp-3)]" onClick={carregar}>
            Tentar de novo
          </Button>
        </Card>
      )}

      {estado === 'success' && (
        <>
          <div role="group" aria-label="Resumo do dia" className="flex gap-[var(--esp-3)] mt-[var(--esp-4)]">
            <div className="flex-1 text-center bg-[var(--cor-superficie)] border border-[var(--cor-borda)] rounded-[var(--raio)] p-[var(--esp-3)]">
              <b className="block text-[length:var(--texto-xl)] text-[var(--cor-primaria)]">{ativos.length}</b>
              <span className="text-[var(--cor-texto-suave)] text-[length:var(--texto-sm)]">ocupados</span>
            </div>
            <div className="flex-1 text-center bg-[var(--cor-superficie)] border border-[var(--cor-borda)] rounded-[var(--raio)] p-[var(--esp-3)]">
              <b className="block text-[length:var(--texto-xl)] text-[var(--cor-sucesso)]">
                {itens.filter((i) => i.tipo === 'livre').length}
              </b>
              <span className="text-[var(--cor-texto-suave)] text-[length:var(--texto-sm)]">janelas livres</span>
            </div>
          </div>

          {fechado && (
            <Card borda="aviso" className="mt-[var(--esp-4)]">
              <p className="font-bold">O salão não abre aos domingos.</p>
              <p className="text-[length:var(--texto-sm)] text-[var(--cor-texto-suave)] mt-[var(--esp-1)]">
                Suposição de negócio (ver docs/04-frontend.md) — ajuste <code>DIA_SEMANA_FECHADO</code> se o dia certo for outro.
              </p>
            </Card>
          )}

          {!fechado && (
            <Link to={`/agenda/novo?data=${data}`} className="no-underline">
              <Button bloco className="mt-[var(--esp-4)]">＋ Novo agendamento</Button>
            </Link>
          )}

          {!fechado && todos.length === 0 && (
            <Card className="mt-[var(--esp-4)] text-center">
              <h2 className="text-[length:var(--texto-lg)] font-bold mb-[var(--esp-2)]">Nenhum agendamento neste dia</h2>
              <p className="text-[var(--cor-texto-suave)]">O dia inteiro está livre. Toque em "Novo agendamento" para começar.</p>
            </Card>
          )}

          <ul className="list-none m-0 mt-[var(--esp-4)] p-0 grid gap-[var(--esp-3)]" aria-label="Agenda do dia">
            {itens.map((item, idx) => (
              <li key={idx} className="grid grid-cols-[56px_1fr] gap-[var(--esp-3)] items-start">
                {item.tipo === 'livre' ? (
                  <>
                    <time className="font-bold pt-[var(--esp-4)] tabular-nums">{hhmm(item.de)}</time>
                    <Link
                      to={`/agenda/novo?data=${data}&hora=${hhmm(item.de)}`}
                      aria-label={`Horário livre das ${hhmm(item.de)} às ${hhmm(item.ate)}. Agendar neste horário`}
                      className="flex items-center justify-between border-2 border-dashed border-[var(--cor-borda-campo)] rounded-[var(--raio)] px-[var(--esp-4)] py-[var(--esp-2)] min-h-[var(--alvo-toque)] text-[var(--cor-sucesso)] font-semibold no-underline"
                    >
                      <span>
                        Livre das {hhmm(item.de)} às {hhmm(item.ate)}
                      </span>
                      <span aria-hidden="true">＋</span>
                    </Link>
                  </>
                ) : (
                  <>
                    <time className="font-bold pt-[var(--esp-4)] tabular-nums">{item.a.hora.slice(0, 5)}</time>
                    <Card
                      borda={item.a.status === 'noshow' ? 'aviso' : 'primaria'}
                      className={item.a.status === 'cancelado' ? 'opacity-85' : ''}
                    >
                      <div className="mb-1">
                        {item.a.status === 'ativo' && <Badge tom="ocupado" texto="● Ocupado" />}
                        {item.a.status === 'cancelado' && <Badge tom="cancelado" texto="✕ Cancelado" />}
                        {item.a.status === 'noshow' && <Badge tom="noshow" texto="! Não compareceu" />}
                      </div>
                      <p className={`font-bold ${item.a.status === 'cancelado' ? 'line-through' : ''}`}>{item.a.cliente_nome}</p>
                      <p className="text-[var(--cor-texto-suave)] text-[length:var(--texto-sm)]">
                        {item.a.servico ? `${item.a.servico.nome} · ${item.a.servico.duracao_min} min` : 'Serviço removido'} ·{' '}
                        {item.a.cliente_telefone}
                      </p>
                      {item.a.status === 'ativo' && (
                        <div className="grid grid-cols-2 gap-[var(--esp-2)] mt-[var(--esp-3)]">
                          <Button
                            variante="secundario"
                            pequeno
                            aria-label={`Cancelar agendamento de ${item.a.cliente_nome}`}
                            onClick={() => cancelar(item.a)}
                          >
                            Cancelar
                          </Button>
                          <Button
                            variante="secundario"
                            pequeno
                            aria-label={`Marcar ${item.a.cliente_nome} como não compareceu`}
                            onClick={() => marcarNoShow(item.a)}
                          >
                            Não compareceu
                          </Button>
                        </div>
                      )}
                    </Card>
                  </>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
      {Dialog}
    </Layout>
  );
}
