/**
 * Parser mínimo de arquivos STEP/IFC (ISO-10303-21), focado no que o importador
 * precisa: indexar entidades por id e decodificar seus argumentos. Não é um
 * parser IFC completo (não valida o schema), mas cobre a sintaxe usada pelos
 * exportadores comuns (Eberick/IfcPlusPlus, e em geral qualquer IFC4 "achatado").
 */

export type Arg =
  | { k: 'ref'; id: number }
  | { k: 'str'; v: string }
  | { k: 'num'; v: number }
  | { k: 'enum'; v: string }
  | { k: 'null' }
  | { k: 'star' }
  | { k: 'list'; items: Arg[] }
  | { k: 'typed'; name: string; items: Arg[] };

export interface StepEntity {
  type: string;
  argsRaw: string;
}

export interface StepModel {
  entities: Map<number, StepEntity>;
  /** cache de argumentos já parseados, por id */
  argsCache: Map<number, Arg[]>;
}

/** Decodifica o escape de caracteres estendidos do STEP: \S\X vira charCode(X)+128. */
export function decodeStepString(s: string): string {
  let out = '';
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '\\' && s[i + 1] === 'S' && s[i + 2] === '\\' && i + 3 < s.length) {
      out += String.fromCharCode(s.charCodeAt(i + 3) + 128);
      i += 3;
    } else {
      out += s[i];
    }
  }
  return out;
}

/** Faz o parse do texto de um arquivo IFC e monta o índice id -> {type, argsRaw}. */
export function parseStepModel(text: string): StepModel {
  const entities = new Map<number, StepEntity>();
  const re = /^#(\d+)\s*=\s*([A-Za-z0-9_]+)\s*\((.*)\)\s*;\s*$/;
  const lines = text.split(/\r\n|\r|\n/);
  for (const line of lines) {
    const m = re.exec(line);
    if (!m) continue;
    entities.set(parseInt(m[1], 10), { type: m[2].toUpperCase(), argsRaw: m[3] });
  }
  return { entities, argsCache: new Map() };
}

/** Parser recursivo-descendente dos argumentos de uma entidade (string entre os parênteses externos). */
export function parseArgs(raw: string): Arg[] {
  let i = 0;
  const n = raw.length;

  function skipWs() {
    while (i < n && raw[i] === ' ') i++;
  }

  function parseValue(): Arg {
    const c = raw[i];
    if (c === "'") {
      i++;
      let out = '';
      while (i < n) {
        if (raw[i] === "'") {
          if (raw[i + 1] === "'") {
            out += "'";
            i += 2;
            continue;
          }
          i++;
          break;
        }
        out += raw[i];
        i++;
      }
      return { k: 'str', v: decodeStepString(out) };
    }
    if (c === '#') {
      i++;
      const start = i;
      while (i < n && raw[i] >= '0' && raw[i] <= '9') i++;
      return { k: 'ref', id: parseInt(raw.slice(start, i), 10) };
    }
    if (c === '$') {
      i++;
      return { k: 'null' };
    }
    if (c === '*') {
      i++;
      return { k: 'star' };
    }
    if (c === '.') {
      i++;
      const start = i;
      while (i < n && raw[i] !== '.') i++;
      const v = raw.slice(start, i);
      i++; // fecha o ponto final
      return { k: 'enum', v };
    }
    if (c === '(') {
      i++;
      const items: Arg[] = [];
      skipWs();
      if (raw[i] === ')') {
        i++;
        return { k: 'list', items };
      }
      while (i < n) {
        items.push(parseValue());
        skipWs();
        if (raw[i] === ',') {
          i++;
          skipWs();
          continue;
        }
        if (raw[i] === ')') {
          i++;
          break;
        }
        break;
      }
      return { k: 'list', items };
    }
    // número ou nome de tipo seguido de '(' (ex.: IFCPOSITIVELENGTHMEASURE(4.5))
    const start = i;
    while (i < n && /[A-Za-z0-9+\-.E]/.test(raw[i])) i++;
    const token = raw.slice(start, i);
    skipWs();
    if (raw[i] === '(') {
      const inner = parseValue() as { k: 'list'; items: Arg[] };
      return { k: 'typed', name: token, items: inner.items };
    }
    return { k: 'num', v: parseFloat(token) };
  }

  const items: Arg[] = [];
  skipWs();
  while (i < n) {
    items.push(parseValue());
    skipWs();
    if (raw[i] === ',') {
      i++;
      skipWs();
      continue;
    }
    break;
  }
  return items;
}

export function getArgs(model: StepModel, id: number): Arg[] | undefined {
  const cached = model.argsCache.get(id);
  if (cached) return cached;
  const ent = model.entities.get(id);
  if (!ent) return undefined;
  const parsed = parseArgs(ent.argsRaw);
  model.argsCache.set(id, parsed);
  return parsed;
}

export function getType(model: StepModel, id: number): string | undefined {
  return model.entities.get(id)?.type;
}

// --- Helpers de leitura de valores individuais ---

export function asRefId(a: Arg | undefined): number | undefined {
  return a?.k === 'ref' ? a.id : undefined;
}

export function asNum(a: Arg | undefined): number | undefined {
  if (!a) return undefined;
  if (a.k === 'num') return a.v;
  if (a.k === 'typed') return asNum(a.items[0]);
  return undefined;
}

export function asStr(a: Arg | undefined): string | undefined {
  if (!a) return undefined;
  if (a.k === 'str') return a.v;
  if (a.k === 'typed') return asStr(a.items[0]);
  return undefined;
}

export function asList(a: Arg | undefined): Arg[] | undefined {
  return a?.k === 'list' ? a.items : undefined;
}

export function asVec3(a: Arg | undefined): [number, number, number] | undefined {
  const items = asList(a);
  if (!items || items.length < 2) return undefined;
  const x = asNum(items[0]) ?? 0;
  const y = asNum(items[1]) ?? 0;
  const z = asNum(items[2]) ?? 0;
  return [x, y, z];
}
