import type { CamadaVisivel } from '../types';

const CAMADAS: { id: CamadaVisivel; label: string }[] = [
  { id: 'forma', label: 'Fôrma' },
  { id: 'concreto', label: 'Concreto' },
  { id: 'armadura', label: 'Armadura' },
];

interface Props {
  camadas: Set<CamadaVisivel>;
  onToggle: (camada: CamadaVisivel) => void;
}

export function LayerToggle({ camadas, onToggle }: Props) {
  return (
    <div className="layer-toggle">
      {CAMADAS.map((c) => (
        <label key={c.id}>
          <input type="checkbox" checked={camadas.has(c.id)} onChange={() => onToggle(c.id)} />
          {c.label}
        </label>
      ))}
    </div>
  );
}
