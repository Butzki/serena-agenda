import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { useConfirmDialog } from '../components/ConfirmDialog';
import { supabase } from '../lib/supabase';
import {
  addDias,
  dataExtensa,
  expedienteDoDia,
  hhmm,
  intervalosOcupados,
  iso,
  min,
  motivoFechado,
} from '../lib/horarios';
import type { AgendamentoComServico, ExpedienteDia, Feriado } from '../lib/types';

type Estado = 'loading' | 'success' | 'error';
type Item =
  | { tipo: 'livre'; t: number; de: number; ate: number }
  | { tipo: 'pausa'; t: number; de: number; ate: number }
  | { tipo: 'ag'; t: number; a: AgendamentoComServico };

export function AgendaPage() {
  const [params] = useSearchParams();
  const data = params.get('data') || iso(new Date());
  const { Dialog, confirmar } = useConfirmDialog();

  const [estado, setEstado] = useState<Estado>('loading');
  const [erro, setErro] = useState('');
  const [agendamentos, setAgendamentos] = useState<AgendamentoComServico[]>([]);
  const [feriados, setFeriados] = useState<Feriado[]>([]);
  const [expedientes, setExpedientes] = useState<ExpedienteDia[]>([]);
  const [erroAcao, setErroAcao] = useState('');

  const carregar = useCallback(async () => {
    setEstado('loading');
    setErroAcao('');
    const [resAgendamentos, resFeriados, resExpediente] = await Promise.all([
      supabase.from('agendamentos').select('*, servico:servicos(*)').eq('data', data).order('hora'),
      supabase.from('feriados').select('*'),
      supabase.from('expediente_semana').select('*'),
    ]);
    if (resAgendamentos.error) {
      setErro(resAgendamentos.error.message);
      setEstado('error');
      return;
    }
    setAgendamentos(resAgendamentos.data as unknown as AgendamentoComServico[]);
    // feriados/expediente são avisos complementares; se falharem, a tela ainda funciona (assume aberto).
    setFeriados(resFeriados.data ?? []);
    setExpedientes(resExpediente.data ?? []);
    setEstado('success');
  }, [data]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // BUG-02 (Aula 05): era `status !== 'cancelado'`, então "não compareceu" continuava
  // ocupando a agenda e o contador, embora a regra de conflito (front e trigger) já
  // liberasse o horário. US-05: marcar no-show serve para "liberar o horário".
  const ativos = agendamentos.filter((a) => a.status === 'ativo');
  const todos = agendamentos;
  const motivo = motivoFechado(data, feriados, expedientes);
  const fechado = !!motivo;
  const expediente = expedienteDoDia(data, expedientes);

  const itens: Item[] = [];
  if (!fechado && expediente?.hora_abre && expediente?.hora_fecha) {
    const abre = min(expediente.hora_abre.slice(0, 5));
    const fecha = min(expediente.hora_fecha.slice(0, 5));
    let cursor = abre;
    intervalosOcupados(ativos, expediente).forEach(({ ini, fim }) => {
      if (ini - cursor >= 30) itens.push({ tipo: 'livre', t: cursor, de: cursor, ate: ini });
      cursor = Math.max(cursor, fim);
    });
    if (fecha - cursor >= 30) itens.push({ tipo: 'livre', t: cursor, de: cursor, ate: fecha });
    if (expediente.pausa_inicio && expediente.pausa_fim) {
      itens.push({
        tipo: 'pausa',
        t: min(expediente.pausa_inicio.slice(0, 5)),
        de: min(expediente.pausa_inicio.slice(0, 5)),
        ate: min(expediente.pausa_fim.slice(0, 5)),
      });
    }
  }
  todos.forEach((a) => itens.push({ tipo: 'ag', t: min(a.hora.slice(0, 5)), a }));
  itens.sort((x, y) => x.t - y.t);

  const ext = dataExtensa(data);
  const dataAnterior = iso(addDias(new Date(data + 'T12:00'), -1));
  const dataProxima = iso(addDias(new Date(data + 'T12:00'), 1));

  /** BUG-01 (Aula 05): antes, qualquer erro aqui era ignorado (`if (error) return;`) e a
      tela ficava parada sem explicação — violava a US-05 AC4. Agora o status anterior é
      mantido e a mensagem diz o porquê: a regra do banco (ex.: horário já reocupado ao
      desfazer um "não compareceu") ou falha de conexão. */
  async function mudarStatus(a: AgendamentoComServico, status: AgendamentoComServico['status'], acao: string) {
    setErroAcao('');
    const { error } = await supabase.from('agendamentos').update({ status }).eq('id', a.id);
    if (error) {
      setErroAcao(
        error.code === 'P0001'
          ? `Não foi possível ${acao} (${a.cliente_nome}): ${error.message}`
          : `Não foi possível ${acao} (${a.cliente_nome}). Verifique sua conexão e tente de novo.`
      );
      return;
    }
    carregar();
  }

  async function cancelar(a: AgendamentoComServico) {
    const ok = await confirmar({
      titulo: 'Cancelar agendamento?',
      texto: `${a.cliente_nome} às ${a.hora.slice(0, 5)}. O horário ficará livre.`,
      rotuloOk: 'Sim, cancelar',
      perigo: true,
    });
    if (!ok) return;
    await mudarStatus(a, 'cancelado', 'cancelar');
  }

  async function marcarNoShow(a: AgendamentoComServico) {
    await mudarStatus(a, 'noshow', 'marcar "não compareceu"');
  }

  /** Corrige um clique indevido em "Não compareceu" (achado no teste heurístico da Aula 02, § 6.2 H3). */
  async function desfazerNoShow(a: AgendamentoComServico) {
    await mudarStatus(a, 'ativo', 'desfazer "não compareceu"');
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

          {erroAcao && (
            <p
              role="alert"
              className="mt-[var(--esp-4)] rounded-[var(--raio)] px-[var(--esp-4)] py-[var(--esp-3)] text-[length:var(--texto-sm)] border bg-[var(--cor-perigo-fundo)] text-[#7A1913] border-[var(--cor-perigo)]"
            >
              {erroAcao}
            </p>
          )}

          {fechado && (
            <Card borda="aviso" className="mt-[var(--esp-4)]">
              <p className="font-bold">{motivo}</p>
              <Link to="/horarios" className="text-[length:var(--texto-sm)] text-[var(--cor-primaria)] font-semibold">
                Ajustar horários →
              </Link>
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
                {item.tipo === 'livre' && (
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
                )}

                {item.tipo === 'pausa' && (
                  <>
                    <time className="font-bold pt-[var(--esp-4)] tabular-nums">{hhmm(item.de)}</time>
                    <div className="flex items-center justify-between rounded-[var(--raio)] px-[var(--esp-4)] py-[var(--esp-2)] min-h-[var(--alvo-toque)] text-[var(--cor-texto-suave)] font-semibold bg-[#ECE6E8]">
                      <span>
                        Pausa (almoço) das {hhmm(item.de)} às {hhmm(item.ate)}
                      </span>
                    </div>
                  </>
                )}

                {item.tipo === 'ag' && (
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
                      {item.a.status === 'noshow' && (
                        <div className="mt-[var(--esp-3)]">
                          <Button
                            variante="secundario"
                            pequeno
                            aria-label={`Desfazer "não compareceu" de ${item.a.cliente_nome}`}
                            onClick={() => desfazerNoShow(item.a)}
                          >
                            Desfazer
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
