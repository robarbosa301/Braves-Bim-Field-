import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { BimElement, IdEtapa } from '../types';
import { criarElementoPadrao } from '../lib/factories';

interface ProjectState {
  nomeObra: string;
  elementos: BimElement[];
  elementoSelecionadoId: string | null;

  setNomeObra: (nome: string) => void;
  adicionarElemento: (tipo: BimElement['tipo'], tag: string) => void;
  atualizarElemento: (id: string, patch: Partial<BimElement>) => void;
  removerElemento: (id: string) => void;
  selecionarElemento: (id: string | null) => void;
  marcarEtapa: (
    elementoId: string,
    etapa: IdEtapa,
    executado: boolean,
    extra?: { dataExecucao?: string; observacao?: string; volumeRealM3?: number },
  ) => void;
}

export const useProjectStore = create<ProjectState>()(
  persist(
    (set) => ({
      nomeObra: 'Minha Obra',
      elementos: [],
      elementoSelecionadoId: null,

      setNomeObra: (nome) => set({ nomeObra: nome }),

      adicionarElemento: (tipo, tag) =>
        set((state) => {
          const offset = state.elementos.length * 1.5;
          const novo = criarElementoPadrao(tipo, tag, { x: offset, y: 0, z: 0 });
          return { elementos: [...state.elementos, novo], elementoSelecionadoId: novo.id };
        }),

      atualizarElemento: (id, patch) =>
        set((state) => ({
          elementos: state.elementos.map((el) => (el.id === id ? ({ ...el, ...patch } as BimElement) : el)),
        })),

      removerElemento: (id) =>
        set((state) => ({
          elementos: state.elementos.filter((el) => el.id !== id),
          elementoSelecionadoId: state.elementoSelecionadoId === id ? null : state.elementoSelecionadoId,
        })),

      selecionarElemento: (id) => set({ elementoSelecionadoId: id }),

      marcarEtapa: (elementoId, etapa, executado, extra) =>
        set((state) => ({
          elementos: state.elementos.map((el) => {
            if (el.id !== elementoId) return el;
            return {
              ...el,
              etapas: el.etapas.map((e) =>
                e.etapa === etapa
                  ? {
                      ...e,
                      executado,
                      dataExecucao: executado ? extra?.dataExecucao ?? new Date().toISOString().slice(0, 10) : undefined,
                      observacao: extra?.observacao ?? e.observacao,
                      volumeRealM3: extra?.volumeRealM3 ?? e.volumeRealM3,
                    }
                  : e,
              ),
            };
          }),
        })),
    }),
    { name: 'braves-bim-field-project' },
  ),
);
