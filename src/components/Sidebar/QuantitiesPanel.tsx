import type { QuantitativoElemento } from '../../lib/quantities';

function n(v: number, casas = 2) {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
}

export function QuantitiesPanel({ q }: { q: QuantitativoElemento }) {
  return (
    <div className="quantities">
      <section>
        <h4>Fôrma de madeira</h4>
        <p>
          {n(q.forma.comprimentoM)} × {n(q.forma.larguraM)} × {n(q.forma.alturaM)} m (C×L×A)
        </p>
        <table>
          <tbody>
            {q.forma.faces.map((f) => (
              <tr key={f.nome}>
                <td>{f.nome}</td>
                <td>
                  {n(f.larguraM)} × {n(f.alturaM)} m
                </td>
                <td>{n(f.areaM2)} m²</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="total">Área total: {n(q.forma.areaTotalM2)} m²</p>
      </section>

      <section>
        <h4>Concreto</h4>
        <p className="total">Volume: {n(q.volumeConcretoM3, 3)} m³</p>
        <table>
          <tbody>
            <tr>
              <td>Cimento</td>
              <td>
                {n(q.concreto.cimentoSacos, 1)} sacos ({n(q.concreto.cimentoKg, 1)} kg)
              </td>
            </tr>
            <tr>
              <td>Areia</td>
              <td>
                {n(q.concreto.areiaM3, 3)} m³ ({n(q.concreto.areiaKg, 1)} kg)
              </td>
            </tr>
            <tr>
              <td>Brita</td>
              <td>
                {n(q.concreto.britaM3, 3)} m³ ({n(q.concreto.britaKg, 1)} kg)
              </td>
            </tr>
            <tr>
              <td>Água</td>
              <td>{n(q.concreto.aguaLitros, 1)} L</td>
            </tr>
          </tbody>
        </table>
        <p className="hint">
          Consumo de cimento: {n(q.concreto.consumoCimentoKgM3, 1)} kg/m³ (
          {q.concreto.origemConsumo === 'informado' ? 'informado manualmente' : 'calculado pelo traço'}).
        </p>
      </section>

      <section>
        <h4>Armadura</h4>
        <table>
          <tbody>
            {q.armadura.grupos.map((g) => (
              <tr key={g.descricao}>
                <td>{g.descricao}</td>
                <td>{g.quantidade} un.</td>
                <td>{n(g.comprimentoUnitarioM)} m/un</td>
                <td>{n(g.pesoKg, 1)} kg</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="total">
          Total: {n(q.armadura.comprimentoTotalM)} m · {n(q.armadura.pesoTotalKg, 1)} kg · {n(q.armadura.volumeTotalM3, 4)} m³
        </p>
      </section>
    </div>
  );
}
