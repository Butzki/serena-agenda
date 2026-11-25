import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { supabase } from '../lib/supabase';
import {
  ANTECEDENCIA_PADRAO_DIAS,
  dataLimiteAgendamento,
  iso,
  mascararTelefone,
  motivoConflito,
  motivoFechado,
  sugestoes,
} from '../lib/horarios';
import type { AgendamentoComServico, ExpedienteDia, Feriado, Servico } from '../lib/types';

type EstadoServicos = 'loading' | 'pronto' | 'vazio' | 'error';

export function NovoAgendamentoPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const dataInicial = params.get('data') || iso(new Date());
  const horaInicial = params.get('hora') || '';

  const [estadoServicos, setEstadoServicos] = useState<EstadoServicos>('loading');
  const [erroServicos, setErroServicos] = useState('');
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [feriados, setFeriados] = useState<Feriado[]>([]);
  const [expedientes, setExpedientes] = useState<ExpedienteDia[]>([]);
  const [antecedenciaDias, setAntecedenciaDias] = useState(ANTECEDENCIA_PADRAO_DIAS);

  const [clienteNome, setClienteNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [servicoId, setServicoId] = useState('');
  const [data, setData] = useState(dataInicial);
  const [hora, setHora] = useState(horaInicial);

  const [erros, setErros] = useState<Record<string, string>>({});
  const [conflitoMsg, setConflitoMsg] = useState<{ texto: string; sugestoes: string[] } | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erroSalvar, setErroSalvar] = useState('');

  useEffect(() => {
    (async () => {
      const [resServicos, resFeriados, resExpediente, resConfig] = await Promise.all([
        supabase.from('servicos').select('*').order('nome'),
        supabase.from('feriados').select('*'),
        supabase.from('expediente_semana').select('*'),
        supabase.from('configuracao').select('*').eq('id', 1).maybeSingle(),
      ]);
      if (resServicos.error) {
        setErroServicos(resServicos.error.message);
        setEstadoServicos('error');
        return;
      }
      setServicos(resServicos.data);
      setFeriados(resFeriados.data ?? []);
      setExpedientes(resExpediente.data ?? []);
      // Se a tabela ainda não existe (schema antigo), vale o padrão de 30 dias.
      if (resConfig.data?.antecedencia_max_dias) setAntecedenciaDias(resConfig.data.antecedencia_max_dias);
      setEstadoServicos(resServicos.data.length === 0 ? 'vazio' : 'pronto');
      if (resServicos.data.length > 0) setServicoId((atual) => atual || resServicos.data[0].id);
    })();
  }, []);

  function validar(): boolean {
    const e: Record<string, string> = {};
    if (clienteNome.trim().length < 3) e.clienteNome = 'Informe o nome da cliente (mínimo 3 letras).';
    const digitos = telefone.replace(/\D/g, '');
    if (digitos.length < 10 || digitos.length > 11) e.telefone = 'Informe um telefone válido com DDD.';
    if (!servicoId) e.servicoId = 'Escolha um serviço.';
    const passado = !data || !hora || new Date(`${data}T${hora}`) < new Date();
    if (!data) e.data = 'Escolha a data.';
    else if (data > dataLimiteAgendamento(antecedenciaDias)) {
      e.data = `Só é possível agendar até ${antecedenciaDias} dias à frente.`;
    } else {
      const motivo = motivoFechado(data, feriados, expedientes);
      if (motivo) e.data = `${motivo} Escolha outro dia.`;
    }
    if (!hora) e.hora = 'Escolha a hora.';
    else if (passado) e.hora = 'Não é possível agendar em horário que já passou.';
    setErros(e);
    return Object.keys(e).length === 0;
  }

  async function salvar(ev: React.FormEvent) {
    ev.preventDefault();
    setErroSalvar('');
    setConflitoMsg(null);
    if (!validar()) return;

    const servico = servicos.find((s) => s.id === servicoId)!;
    setSalvando(true);

    const { data: doDia, error: erroConsulta } = await supabase
      .from('agendamentos')
      .select('*, servico:servicos(*)')
      .eq('data', data);

    if (erroConsulta) {
      setSalvando(false);
      setErroSalvar('Não foi possível verificar conflitos. Verifique sua conexão e tente de novo.');
      return;
    }

    const doDiaTipado = doDia as unknown as AgendamentoComServico[];
    const motivo = motivoConflito(doDiaTipado, data, hora, servico.duracao_min, feriados, expedientes);
    if (motivo) {
      setSalvando(false);
      setConflitoMsg({ texto: motivo, sugestoes: sugestoes(doDiaTipado, data, hora, servico.duracao_min, feriados, expedientes) });
      return;
    }

    const { error } = await supabase.from('agendamentos').insert({
      cliente_nome: clienteNome.trim(),
      cliente_telefone: telefone.trim(),
      servico_id: servicoId,
      data,
      hora,
      status: 'ativo',
    });

    setSalvando(false);

    if (error) {
      // Defesa em profundidade do banco (RF05, docs/03-backend.md item 4; docs/04-frontend.md § 5):
      // pode disparar em corrida com outra escrita simultânea, mesmo já tendo passado na checagem acima.
      if (
        error.message.includes('Conflito de horário') ||
        error.message.includes('já passou') ||
        error.message.includes('dias à frente') ||
        error.message.includes('não abre') ||
        error.message.includes('Fora do horário') ||
        error.message.includes('intervalo de almoço')
      ) {
        setConflitoMsg({ texto: error.message, sugestoes: [] });
      } else {
        setErroSalvar('Não foi possível salvar. Verifique sua conexão e tente de novo.');
      }
      return;
    }

    navigate(`/agenda?data=${data}`, { state: { toast: 'Agendamento salvo.' } });
  }

  if (estadoServicos === 'loading') {
    return (
      <Layout titulo="Novo agendamento" voltarPara="/agenda" ariaVoltar="Voltar para a agenda">
        <p className="text-[var(--cor-texto-suave)] text-center mt-[var(--esp-5)]">Carregando serviços…</p>
      </Layout>
    );
  }

  if (estadoServicos === 'error') {
    return (
      <Layout titulo="Novo agendamento" voltarPara="/agenda" ariaVoltar="Voltar para a agenda">
        <Card borda="aviso" className="mt-[var(--esp-4)]">
          <p className="font-bold text-[var(--cor-perigo)]">Não foi possível carregar os serviços.</p>
          <p className="text-[length:var(--texto-sm)] text-[var(--cor-texto-suave)] mt-[var(--esp-1)]">{erroServicos}</p>
        </Card>
      </Layout>
    );
  }

  if (estadoServicos === 'vazio') {
    return (
      <Layout titulo="Novo agendamento" voltarPara="/agenda" ariaVoltar="Voltar para a agenda">
        <Card className="mt-[var(--esp-4)] text-center">
          <h2 className="text-[length:var(--texto-lg)] font-bold mb-[var(--esp-2)]">Nenhum serviço cadastrado</h2>
          <p className="text-[var(--cor-texto-suave)] mb-[var(--esp-4)]">
            Cadastre um serviço antes de criar um agendamento.
          </p>
          <Button onClick={() => navigate('/servicos/novo')}>Cadastrar serviço</Button>
        </Card>
      </Layout>
    );
  }

  return (
    <Layout titulo="Novo agendamento" voltarPara="/agenda" ariaVoltar="Voltar para a agenda">
      {conflitoMsg && (
        <div role="alert" tabIndex={-1} className="rounded-[var(--raio)] px-[var(--esp-4)] py-[var(--esp-3)] text-[length:var(--texto-sm)] border bg-[var(--cor-perigo-fundo)] text-[#7A1913] border-[var(--cor-perigo)] mb-[var(--esp-4)]">
          <strong className="block">Horário indisponível</strong>
          <span>{conflitoMsg.texto}</span>
          {conflitoMsg.sugestoes.length > 0 && (
            <div role="group" aria-label="Horários livres sugeridos" className="flex gap-[var(--esp-2)] flex-wrap mt-[var(--esp-2)]">
              {conflitoMsg.sugestoes.map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => {
                    setHora(h);
                    setConflitoMsg(null);
                  }}
                  className="min-h-[44px] px-[var(--esp-3)] rounded-full border-2 border-[var(--cor-primaria)] bg-[var(--cor-superficie)] text-[var(--cor-primaria)] font-semibold"
                >
                  {h}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <form onSubmit={salvar} noValidate className="grid gap-[var(--esp-4)]">
        <Input id="cliente" label="Nome da cliente" value={clienteNome} onChange={(e) => setClienteNome(e.target.value)} erro={erros.clienteNome} autoComplete="off" required />
        <Input
          id="telefone"
          label="Telefone (WhatsApp)"
          value={telefone}
          onChange={(e) => setTelefone(mascararTelefone(e.target.value))}
          erro={erros.telefone}
          inputMode="tel"
          placeholder="(49) 99999-9999"
          autoComplete="off"
          required
        />
        <Input id="servico" as="select" label="Serviço" value={servicoId} onChange={(e) => setServicoId(e.target.value)} erro={erros.servicoId} required>
          {servicos.map((s) => (
            <option key={s.id} value={s.id}>
              {s.nome} · {s.duracao_min} min
            </option>
          ))}
        </Input>
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-[var(--esp-3)]">
          <Input id="data" label="Data" type="date" min={iso(new Date())} max={dataLimiteAgendamento(antecedenciaDias)} value={data} onChange={(e) => setData(e.target.value)} erro={erros.data} required />
          <Input id="hora" label="Hora" type="time" step={900} value={hora} onChange={(e) => setHora(e.target.value)} erro={erros.hora} required />
        </div>
        <p className="rounded-[var(--raio)] px-[var(--esp-4)] py-[var(--esp-3)] text-[length:var(--texto-sm)] border border-[var(--cor-borda)] text-[var(--cor-texto-suave)] bg-[var(--cor-superficie)]">
          Guardamos só nome e telefone, para organizar a agenda do salão.
        </p>

        {erroSalvar && (
          <p role="alert" className="rounded-[var(--raio)] px-[var(--esp-4)] py-[var(--esp-3)] text-[length:var(--texto-sm)] border bg-[var(--cor-perigo-fundo)] text-[#7A1913] border-[var(--cor-perigo)]">
            {erroSalvar}
          </p>
        )}

        <div className="grid gap-[var(--esp-3)] mt-[var(--esp-2)]">
          <Button type="submit" bloco disabled={salvando}>
            {salvando ? 'Salvando…' : 'Salvar agendamento'}
          </Button>
          <Button type="button" variante="secundario" bloco onClick={() => navigate('/agenda')}>
            Cancelar
          </Button>
        </div>
      </form>
    </Layout>
  );
}
