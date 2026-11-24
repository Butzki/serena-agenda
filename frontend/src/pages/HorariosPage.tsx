import { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { useConfirmDialog } from '../components/ConfirmDialog';
import { supabase } from '../lib/supabase';
import { NOME_DIA } from '../lib/horarios';
import type { ExpedienteDia, Feriado } from '../lib/types';

type Estado = 'loading' | 'success' | 'error';

function hhmm(valor: string | null): string {
  return valor ? valor.slice(0, 5) : '';
}

export function HorariosPage() {
  const { Dialog, confirmar } = useConfirmDialog();

  const [estado, setEstado] = useState<Estado>('loading');
  const [erro, setErro] = useState('');
  const [dias, setDias] = useState<ExpedienteDia[]>([]);
  const [feriados, setFeriados] = useState<Feriado[]>([]);

  const [errosDias, setErrosDias] = useState<Record<number, string>>({});
  const [salvando, setSalvando] = useState(false);
  const [erroSalvar, setErroSalvar] = useState('');
  const [salvo, setSalvo] = useState(false);

  const [novaData, setNovaData] = useState('');
  const [novoMotivo, setNovoMotivo] = useState('');
  const [erroFeriado, setErroFeriado] = useState('');
  const [salvandoFeriado, setSalvandoFeriado] = useState(false);

  async function carregar() {
    setEstado('loading');
    const [resDias, resFeriados] = await Promise.all([
      supabase.from('expediente_semana').select('*').order('dia_semana'),
      supabase.from('feriados').select('*').order('data'),
    ]);
    if (resDias.error) {
      setErro(resDias.error.message);
      setEstado('error');
      return;
    }
    setDias(resDias.data);
    setFeriados(resFeriados.data ?? []);
    setEstado('success');
  }

  useEffect(() => {
    carregar();
  }, []);

  function atualizarDia(dia_semana: number, patch: Partial<ExpedienteDia>) {
    setDias((prev) => prev.map((d) => (d.dia_semana === dia_semana ? { ...d, ...patch } : d)));
  }

  function validarDias(): boolean {
    const erros: Record<number, string> = {};
    dias.forEach((d) => {
      if (d.fechado) return;
      if (!d.hora_abre || !d.hora_fecha) {
        erros[d.dia_semana] = 'Informe o horário de abertura e fechamento.';
        return;
      }
      if (d.hora_abre >= d.hora_fecha) {
        erros[d.dia_semana] = 'O horário de abertura precisa ser antes do de fechamento.';
        return;
      }
      if (d.pausa_inicio || d.pausa_fim) {
        if (!d.pausa_inicio || !d.pausa_fim) {
          erros[d.dia_semana] = 'Informe o início e o fim da pausa, ou deixe os dois em branco.';
          return;
        }
        if (d.pausa_inicio >= d.pausa_fim) {
          erros[d.dia_semana] = 'O início da pausa precisa ser antes do fim.';
          return;
        }
        if (d.pausa_inicio < d.hora_abre || d.pausa_fim > d.hora_fecha) {
          erros[d.dia_semana] = 'A pausa precisa caber dentro do expediente do dia.';
          return;
        }
      }
    });
    setErrosDias(erros);
    return Object.keys(erros).length === 0;
  }

  async function salvarHorarios() {
    setErroSalvar('');
    setSalvo(false);
    if (!validarDias()) return;
    setSalvando(true);
    const payload = dias.map((d) => ({
      dia_semana: d.dia_semana,
      fechado: d.fechado,
      hora_abre: d.fechado ? null : d.hora_abre,
      hora_fecha: d.fechado ? null : d.hora_fecha,
      pausa_inicio: d.fechado ? null : d.pausa_inicio || null,
      pausa_fim: d.fechado ? null : d.pausa_fim || null,
    }));
    const { error } = await supabase.from('expediente_semana').upsert(payload, { onConflict: 'dia_semana' });
    setSalvando(false);
    if (error) {
      setErroSalvar('Não foi possível salvar. Verifique sua conexão e tente de novo.');
      return;
    }
    setSalvo(true);
    setTimeout(() => setSalvo(false), 4000);
  }

  async function adicionarFeriado(ev: React.FormEvent) {
    ev.preventDefault();
    setErroFeriado('');
    if (!novaData) {
      setErroFeriado('Escolha uma data.');
      return;
    }
    if (novoMotivo.trim().length < 3) {
      setErroFeriado('Descreva o motivo (mínimo 3 letras).');
      return;
    }
    setSalvandoFeriado(true);
    const { error } = await supabase.from('feriados').insert({ data: novaData, motivo: novoMotivo.trim() });
    setSalvandoFeriado(false);
    if (error) {
      setErroFeriado(
        error.message.includes('duplicate') || error.code === '23505'
          ? 'Já existe um feriado cadastrado nessa data.'
          : 'Não foi possível adicionar. Tente de novo.'
      );
      return;
    }
    setNovaData('');
    setNovoMotivo('');
    carregar();
  }

  async function removerFeriado(f: Feriado) {
    const ok = await confirmar({
      titulo: `Remover "${f.motivo}"?`,
      texto: `O salão volta a abrir normalmente em ${f.data.split('-').reverse().join('/')}.`,
      rotuloOk: 'Sim, remover',
      perigo: true,
    });
    if (!ok) return;
    const { error } = await supabase.from('feriados').delete().eq('data', f.data);
    if (error) return;
    carregar();
  }

  return (
    <Layout titulo="Horários" marca>
      <p className="text-[var(--cor-texto-suave)] text-[length:var(--texto-sm)] mt-[var(--esp-3)]">
        Defina o expediente de cada dia da semana e os dias em que o salão não abre. Essas regras valem tanto para o
        que aparece na agenda quanto para o que é aceito ao criar um agendamento.
      </p>

      {estado === 'loading' && <p className="text-[var(--cor-texto-suave)] text-center mt-[var(--esp-5)]">Carregando horários…</p>}

      {estado === 'error' && (
        <Card borda="aviso" className="mt-[var(--esp-4)]">
          <p className="font-bold text-[var(--cor-perigo)]">Não foi possível carregar os horários.</p>
          <p className="text-[length:var(--texto-sm)] text-[var(--cor-texto-suave)] mt-[var(--esp-1)]">{erro}</p>
          <Button pequeno className="mt-[var(--esp-3)]" onClick={carregar}>
            Tentar de novo
          </Button>
        </Card>
      )}

      {estado === 'success' && (
        <>
          <ul className="list-none m-0 mt-[var(--esp-4)] p-0 grid gap-[var(--esp-3)]">
            {dias.map((d) => (
              <li key={d.dia_semana}>
                <Card>
                  <div className="flex items-center justify-between gap-[var(--esp-3)]">
                    <p className="font-bold">{NOME_DIA[d.dia_semana]}</p>
                    <label className="flex items-center gap-[var(--esp-2)] text-[length:var(--texto-sm)] font-semibold">
                      <input
                        type="checkbox"
                        checked={!d.fechado}
                        onChange={(e) => atualizarDia(d.dia_semana, { fechado: !e.target.checked })}
                        className="w-5 h-5"
                      />
                      Aberto
                    </label>
                  </div>

                  {!d.fechado && (
                    <div className="mt-[var(--esp-3)] grid gap-[var(--esp-3)]">
                      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-[var(--esp-3)]">
                        <Input
                          id={`abre-${d.dia_semana}`}
                          label="Abre"
                          type="time"
                          value={hhmm(d.hora_abre)}
                          onChange={(e) => atualizarDia(d.dia_semana, { hora_abre: e.target.value })}
                        />
                        <Input
                          id={`fecha-${d.dia_semana}`}
                          label="Fecha"
                          type="time"
                          value={hhmm(d.hora_fecha)}
                          onChange={(e) => atualizarDia(d.dia_semana, { hora_fecha: e.target.value })}
                        />
                      </div>

                      <label className="flex items-center gap-[var(--esp-2)] text-[length:var(--texto-sm)]">
                        <input
                          type="checkbox"
                          checked={!!(d.pausa_inicio || d.pausa_fim)}
                          onChange={(e) =>
                            atualizarDia(d.dia_semana, e.target.checked ? { pausa_inicio: '12:00', pausa_fim: '13:00' } : { pausa_inicio: null, pausa_fim: null })
                          }
                          className="w-5 h-5"
                        />
                        Tem pausa (almoço)
                      </label>

                      {(d.pausa_inicio || d.pausa_fim) && (
                        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-[var(--esp-3)]">
                          <Input
                            id={`pausa-ini-${d.dia_semana}`}
                            label="Início da pausa"
                            type="time"
                            value={hhmm(d.pausa_inicio)}
                            onChange={(e) => atualizarDia(d.dia_semana, { pausa_inicio: e.target.value })}
                          />
                          <Input
                            id={`pausa-fim-${d.dia_semana}`}
                            label="Fim da pausa"
                            type="time"
                            value={hhmm(d.pausa_fim)}
                            onChange={(e) => atualizarDia(d.dia_semana, { pausa_fim: e.target.value })}
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {errosDias[d.dia_semana] && (
                    <p className="text-[length:var(--texto-sm)] font-semibold text-[var(--cor-perigo)] mt-[var(--esp-2)]">
                      {errosDias[d.dia_semana]}
                    </p>
                  )}
                </Card>
              </li>
            ))}
          </ul>

          {erroSalvar && (
            <p role="alert" className="rounded-[var(--raio)] px-[var(--esp-4)] py-[var(--esp-3)] text-[length:var(--texto-sm)] border bg-[var(--cor-perigo-fundo)] text-[#7A1913] border-[var(--cor-perigo)] mt-[var(--esp-4)]">
              {erroSalvar}
            </p>
          )}
          {salvo && (
            <p role="status" className="rounded-[var(--raio)] px-[var(--esp-4)] py-[var(--esp-3)] text-[length:var(--texto-sm)] border bg-[var(--cor-sucesso-fundo)] text-[#0F4A31] border-[var(--cor-sucesso)] mt-[var(--esp-4)]">
              Horários salvos.
            </p>
          )}

          <Button bloco className="mt-[var(--esp-4)]" disabled={salvando} onClick={salvarHorarios}>
            {salvando ? 'Salvando…' : 'Salvar horários'}
          </Button>

          <h2 className="text-[length:var(--texto-lg)] font-bold mt-[var(--esp-6)] mb-[var(--esp-2)]">Feriados</h2>
          <p className="text-[var(--cor-texto-suave)] text-[length:var(--texto-sm)] mb-[var(--esp-3)]">
            Dias específicos em que o salão não abre, além do expediente semanal acima.
          </p>

          {feriados.length === 0 ? (
            <p className="text-[var(--cor-texto-suave)] text-[length:var(--texto-sm)]">Nenhum feriado cadastrado.</p>
          ) : (
            <ul className="list-none m-0 p-0 grid gap-[var(--esp-2)] mb-[var(--esp-4)]">
              {feriados.map((f) => (
                <li key={f.data}>
                  <Card className="flex items-center justify-between gap-[var(--esp-3)] py-[var(--esp-3)]">
                    <div>
                      <p className="font-bold">{f.data.split('-').reverse().join('/')}</p>
                      <p className="text-[var(--cor-texto-suave)] text-[length:var(--texto-sm)]">{f.motivo}</p>
                    </div>
                    <Button variante="secundario" pequeno aria-label={`Remover feriado ${f.motivo}`} onClick={() => removerFeriado(f)}>
                      Remover
                    </Button>
                  </Card>
                </li>
              ))}
            </ul>
          )}

          <form onSubmit={adicionarFeriado} className="grid gap-[var(--esp-3)]">
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-[var(--esp-3)]">
              <Input id="feriado-data" label="Data" type="date" value={novaData} onChange={(e) => setNovaData(e.target.value)} />
              <Input id="feriado-motivo" label="Motivo" value={novoMotivo} onChange={(e) => setNovoMotivo(e.target.value)} placeholder="Ex.: Natal" />
            </div>
            {erroFeriado && <p className="text-[length:var(--texto-sm)] font-semibold text-[var(--cor-perigo)]">{erroFeriado}</p>}
            <Button type="submit" variante="secundario" bloco disabled={salvandoFeriado}>
              {salvandoFeriado ? 'Adicionando…' : '＋ Adicionar feriado'}
            </Button>
          </form>
        </>
      )}
      {Dialog}
    </Layout>
  );
}
