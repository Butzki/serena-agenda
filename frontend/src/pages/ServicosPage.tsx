import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { supabase } from '../lib/supabase';
import { brl } from '../lib/horarios';
import type { Servico } from '../lib/types';

type Estado = 'loading' | 'success' | 'empty' | 'error';

export function ServicosPage() {
  const [estado, setEstado] = useState<Estado>('loading');
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [erro, setErro] = useState('');

  async function carregar() {
    setEstado('loading');
    const { data, error } = await supabase.from('servicos').select('*').order('nome');
    if (error) {
      setErro(error.message);
      setEstado('error');
      return;
    }
    setServicos(data);
    setEstado(data.length === 0 ? 'empty' : 'success');
  }

  useEffect(() => {
    carregar();
  }, []);

  return (
    <Layout titulo="Serviços" marca>
      <Link to="/servicos/novo" className="no-underline">
        <Button bloco className="mt-[var(--esp-4)]">＋ Novo serviço</Button>
      </Link>
      <p className="text-[var(--cor-texto-suave)] text-[length:var(--texto-sm)] mt-[var(--esp-3)]">
        Toque em "Editar" para alterar nome, duração ou preço.
      </p>

      {estado === 'loading' && (
        <p className="text-[var(--cor-texto-suave)] mt-[var(--esp-5)] text-center">Carregando serviços…</p>
      )}

      {estado === 'error' && (
        <Card borda="aviso" className="mt-[var(--esp-4)]">
          <p className="font-bold text-[var(--cor-perigo)]">Não foi possível carregar os serviços.</p>
          <p className="text-[length:var(--texto-sm)] text-[var(--cor-texto-suave)] mt-[var(--esp-1)]">{erro}</p>
          <Button pequeno className="mt-[var(--esp-3)]" onClick={carregar}>
            Tentar de novo
          </Button>
        </Card>
      )}

      {estado === 'empty' && (
        <Card className="mt-[var(--esp-4)] text-center">
          <h2 className="text-[length:var(--texto-lg)] font-bold mb-[var(--esp-2)]">Nenhum serviço cadastrado</h2>
          <p className="text-[var(--cor-texto-suave)]">Cadastre o primeiro serviço para poder criar agendamentos.</p>
        </Card>
      )}

      {estado === 'success' && (
        <ul className="list-none m-0 mt-[var(--esp-4)] p-0 grid gap-[var(--esp-3)]" aria-label="Serviços cadastrados">
          {servicos.map((s) => (
            <li key={s.id}>
              <Card>
                <p className="font-bold">{s.nome}</p>
                <p className="text-[var(--cor-texto-suave)] text-[length:var(--texto-sm)]">
                  {s.duracao_min} min · {brl(s.preco)}
                </p>
                <div className="mt-[var(--esp-3)]">
                  <Link to={`/servicos/${s.id}/editar`} className="no-underline" aria-label={`Editar ${s.nome}`}>
                    <Button variante="secundario" pequeno>
                      Editar
                    </Button>
                  </Link>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </Layout>
  );
}
