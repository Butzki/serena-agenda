import { useCallback, useRef, useState } from 'react';
import { Button } from './ui/Button';

type Opcoes = { titulo: string; texto: string; rotuloOk: string; perigo?: boolean };

/** Porta do <dialog> de confirmação do protótipo (cancelar/excluir), com a mesma
    semântica: Esc fecha, foco inicial é a opção segura ("Voltar"). */
export function useConfirmDialog() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const resolverRef = useRef<(v: boolean) => void>();
  const [opcoes, setOpcoes] = useState<Opcoes>({ titulo: '', texto: '', rotuloOk: 'Confirmar' });

  const confirmar = useCallback((o: Opcoes) => {
    setOpcoes(o);
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
      dialogRef.current?.showModal();
    });
  }, []);

  function fechar(v: boolean) {
    resolverRef.current?.(v);
    dialogRef.current?.close();
  }

  const Dialog = (
    <dialog
      ref={dialogRef}
      aria-labelledby="dlg-titulo"
      onClose={() => resolverRef.current?.(false)}
      className="rounded-[var(--raio)] p-[var(--esp-5)] w-[min(92vw,400px)] shadow-[0_8px_32px_rgba(0,0,0,.25)] text-[var(--cor-texto)] border-0 backdrop:bg-black/55"
    >
      <h2 id="dlg-titulo" className="text-[length:var(--texto-lg)] font-bold mb-[var(--esp-2)]">
        {opcoes.titulo}
      </h2>
      <p>{opcoes.texto}</p>
      <div className="grid gap-[var(--esp-2)] mt-[var(--esp-4)]">
        <Button type="button" variante={opcoes.perigo ? 'perigo' : 'primario'} onClick={() => fechar(true)}>
          {opcoes.rotuloOk}
        </Button>
        <Button type="button" variante="secundario" autoFocus onClick={() => fechar(false)}>
          Voltar
        </Button>
      </div>
    </dialog>
  );

  return { Dialog, confirmar };
}
