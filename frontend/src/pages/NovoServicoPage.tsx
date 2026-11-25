import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { useConfirmDialog } from '../components/ConfirmDialog';
import { supabase } from '../lib/supabase';
import { brl, conflito, iso, mascararPrecoCentavos } from '../lib/horarios';
import type { AgendamentoComServico } from '../lib/types';

type Carregamento = 'loading' | 'pronto' | 'nao-encontrado' | 'error';

export function NovoServicoPage() {
  const { id } = useParams();
  const editando = !!id;
  const navigate = useNavigate();
  const { Dialog, confirmar } = useConfirmDialog();

  const [carregamento, setCarregamento] = useState<Carregamento>(editando ? 'loading' : 'pronto');
  const [erroCarregar, setErroCarregar] = useState('');
  const [nome, setNome] = useState('');
  const [duracao, setDuracao] = useState('');
  const [precoTexto, setPrecoTexto] = useState('');
  const [duracaoOriginal, setDuracaoOriginal] = useState<number | null>(null);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState(false);
  const [erroSalvar, setErroSalvar] = useState('');

  useEffect(() => {
    if (!editando) return;
    (async () => {
      const { data, error } = await supabase.from('servicos').select('*').eq('id', id).maybeSingle();
      if (error) {
        setErroCarregar(error.message);
        setCarregamento('error');
        return;
      }
      if (!data) {
        setCarregamento('nao-encontrado');
        return;
      }
      setNome(data.nome);
      setDuracao(String(data.duracao_min));
      setDuracaoOriginal(data.duracao_min);
      setPrecoTexto(brl(data.preco));
      setCarregamento('pronto');
    })();
  }, [editando, id]);

  function validar(): boolean {
    const e: Record<string, string> = {};
    if (nome.trim().length < 3) e.nome = 'O nome precisa ter pelo menos 3 letras.';
    if (!/^\d+$/.test(duracao) || +duracao < 10 || +duracao > 480) {
      e.duracao = 'Informe a duração em minutos inteiros, de 10 a 480.';
    }
    const centavos = parseInt(precoTexto.replace(/\D/g, '') || '0', 10);
    if (!centavos) e.preco = 'Informe um preço maior que R$ 0,00.';
    setErros(e);
    return Object.keys(e).length === 0;
  }

  async function salvar(ev: React.FormEvent) {
    ev.preventDefault();
    setErroSalvar('');
    if (!validar()) return;
    setSalvando(true);
    const preco = parseInt(precoTexto.replace(/\D/g, '') || '0', 10) / 100;
    const payload = { nome: nome.trim(), duracao_min: +duracao, preco };

    // BUG-03 (Aula 05): aumentar a duração muda, retroativamente, o fim de todos os
    // agendamentos futuros deste serviço. O trigger do banco só olha `agendamentos`,
    // então a sobreposição passava em silêncio. Agora a proprietária vê quem vai
    // colidir e decide (pode ser intencional), em vez de descobrir no dia.
    if (editando && duracaoOriginal !== null && +duracao > duracaoOriginal) {
      const sobrepostos = await agendamentosQueVaoSobrepor(+duracao);
      if (sobrepostos === null) {
        setSalvando(false);
        setErroSalvar('Não foi possível verificar a agenda. Verifique sua conexão e tente de novo.');
        return;
      }
      if (sobrepostos.length > 0) {
        setSalvando(false);
        const lista = sobrepostos
          .slice(0, 3)
          .map((a) => `${a.cliente_nome} em ${a.data.split('-').reverse().slice(0, 2).join('/')} às ${a.hora.slice(0, 5)}`)
          .join('; ');
        const ok = await confirmar({
          titulo: `Mudar para ${duracao} min?`,
          texto: `${sobrepostos.length} agendamento(s) futuro(s) vão se sobrepor ao próximo horário: ${lista}${sobrepostos.length > 3 ? '…' : ''}. Salvar mesmo assim?`,
          rotuloOk: 'Salvar mesmo assim',
          perigo: true,
        });
        if (!ok) return;
        setSalvando(true);
      }
    }

    const resultado = editando
      ? await supabase.from('servicos').update(payload).eq('id', id)
      : await supabase.from('servicos').insert(payload);

    setSalvando(false);
    if (resultado.error) {
      setErroSalvar('Não foi possível salvar. Verifique sua conexão e tente de novo.');
      return;
    }
    navigate('/servicos', { state: { toast: 'Serviço salvo.' } });
  }

  /** Agendamentos ativos de hoje em diante, deste serviço, que passariam a colidir com outro se a duração fosse `novaDuracao`. null = erro de rede. */
  async function agendamentosQueVaoSobrepor(novaDuracao: number): Promise<AgendamentoComServico[] | null> {
    const { data, error } = await supabase
      .from('agendamentos')
      .select('*, servico:servicos(*)')
      .gte('data', iso(new Date()))
      .eq('status', 'ativo');
    if (error) return null;
    const comNovaDuracao = (data as unknown as AgendamentoComServico[]).map((a) =>
      a.servico_id === id && a.servico ? { ...a, servico: { ...a.servico, duracao_min: novaDuracao } } : a
    );
    return comNovaDuracao.filter(
      (a) =>
        a.servico_id === id &&
        !!conflito(
          comNovaDuracao.filter((b) => b.data === a.data),
          a.hora.slice(0, 5),
          novaDuracao,
          a.id
        )
    );
  }

  async function excluir() {
    const { count } = await supabase
      .from('agendamentos')
      .select('id', { count: 'exact', head: true })
      .eq('servico_id', id)
      .eq('status', 'ativo');
    const usados = count ?? 0;
    const texto = usados
      ? `Há ${usados} agendamento(s) ativo(s) com este serviço. Eles continuarão na agenda.`
      : 'Esta ação não pode ser desfeita.';
    const ok = await confirmar({ titulo: `Excluir "${nome}"?`, texto, rotuloOk: 'Sim, excluir', perigo: true });
    if (!ok) return;
    const { error } = await supabase.from('servicos').delete().eq('id', id);
    if (error) {
      setErroSalvar('Não foi possível excluir. Tente de novo.');
      return;
    }
    navigate('/servicos', { state: { toast: 'Serviço excluído.' } });
  }

  if (carregamento === 'loading') {
    return (
      <Layout titulo="Editar serviço" voltarPara="/servicos" ariaVoltar="Voltar para serviços">
        <p className="text-[var(--cor-texto-suave)] text-center mt-[var(--esp-5)]">Carregando serviço…</p>
      </Layout>
    );
  }

  if (carregamento === 'nao-encontrado' || carregamento === 'error') {
    return (
      <Layout titulo="Serviço" voltarPara="/servicos" ariaVoltar="Voltar para serviços">
        <p className="font-bold text-[var(--cor-perigo)] mt-[var(--esp-4)]">
          {carregamento === 'error' ? `Não foi possível carregar: ${erroCarregar}` : 'Serviço não encontrado.'}
        </p>
      </Layout>
    );
  }

  return (
    <Layout titulo={editando ? 'Editar serviço' : 'Novo serviço'} voltarPara="/servicos" ariaVoltar="Voltar para serviços">
      <form onSubmit={salvar} noValidate className="grid gap-[var(--esp-4)]">
        <Input id="nome" label="Nome do serviço" value={nome} onChange={(e) => setNome(e.target.value)} erro={erros.nome} autoComplete="off" required />
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-[var(--esp-3)]">
          <Input
            id="duracao"
            label="Duração (min)"
            value={duracao}
            onChange={(e) => setDuracao(e.target.value.replace(/\D/g, ''))}
            erro={erros.duracao}
            inputMode="numeric"
            placeholder="60"
            required
          />
          <Input
            id="preco"
            label="Preço"
            value={precoTexto}
            onChange={(e) => setPrecoTexto(mascararPrecoCentavos(e.target.value.replace(/\D/g, '')))}
            erro={erros.preco}
            inputMode="numeric"
            placeholder="R$ 0,00"
            required
          />
        </div>

        {erroSalvar && (
          <p role="alert" className="rounded-[var(--raio)] px-[var(--esp-4)] py-[var(--esp-3)] text-[length:var(--texto-sm)] border bg-[var(--cor-perigo-fundo)] text-[#7A1913] border-[var(--cor-perigo)]">
            {erroSalvar}
          </p>
        )}

        <div className="grid gap-[var(--esp-3)] mt-[var(--esp-2)]">
          <Button type="submit" bloco disabled={salvando}>
            {salvando ? 'Salvando…' : 'Salvar serviço'}
          </Button>
          <Button type="button" variante="secundario" bloco onClick={() => navigate('/servicos')}>
            Cancelar
          </Button>
          {editando && (
            <Button type="button" variante="perigo" bloco onClick={excluir}>
              Excluir serviço
            </Button>
          )}
        </div>
      </form>
      {Dialog}
    </Layout>
  );
}
