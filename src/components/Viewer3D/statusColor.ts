import type { BimElement, IdEtapa } from '../../types';

export function etapaExecutada(elemento: BimElement, etapa: IdEtapa): boolean {
  return elemento.etapas.find((e) => e.etapa === etapa)?.executado ?? false;
}

/** Cor do concreto conforme status de execução: cinza = previsto, verde = concretado. */
export function corConcreto(elemento: BimElement): string {
  return etapaExecutada(elemento, 'concretagem') ? '#4caf7d' : '#b9c0c6';
}

export function corForma(elemento: BimElement): string {
  return etapaExecutada(elemento, 'forma') ? '#c98a3e' : '#e6c9a0';
}

export function corArmadura(elemento: BimElement): string {
  return etapaExecutada(elemento, 'armadura') ? '#d94b4b' : '#8f97a0';
}
