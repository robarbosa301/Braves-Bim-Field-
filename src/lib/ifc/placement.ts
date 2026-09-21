import { asRefId, asVec3, getArgs, getType, type StepModel } from './stepParser';

export type Vec3 = [number, number, number];
/** Matriz de rotação 3x3 em linhas: [ [xx,xy,xz], [yx,yy,yz], [zx,zy,zz] ]. */
export type Mat3 = [Vec3, Vec3, Vec3];

export interface Transform {
  rot: Mat3;
  t: Vec3;
}

const IDENTITY: Transform = { rot: [[1, 0, 0], [0, 1, 0], [0, 0, 1]], t: [0, 0, 0] };

function sub(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}
function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
function cross(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
function scale(a: Vec3, s: number): Vec3 {
  return [a[0] * s, a[1] * s, a[2] * s];
}
function norm(a: Vec3): Vec3 {
  const len = Math.sqrt(dot(a, a)) || 1;
  return scale(a, 1 / len);
}

function mulMat3(a: Mat3, b: Mat3): Mat3 {
  const out: Mat3 = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      out[r][c] = a[r][0] * b[0][c] + a[r][1] * b[1][c] + a[r][2] * b[2][c];
    }
  }
  return out;
}

function mulMat3Vec(m: Mat3, v: Vec3): Vec3 {
  return [dot(m[0], v), dot(m[1], v), dot(m[2], v)];
}

/** Combina uma transformação pai com uma local: resultado = pai ∘ local. */
export function composeTransform(parent: Transform, local: Transform): Transform {
  const rot = mulMat3(parent.rot, local.rot);
  const t = [
    parent.t[0] + mulMat3Vec(parent.rot, local.t)[0],
    parent.t[1] + mulMat3Vec(parent.rot, local.t)[1],
    parent.t[2] + mulMat3Vec(parent.rot, local.t)[2],
  ] as Vec3;
  return { rot, t };
}

export function applyTransform(tr: Transform, p: Vec3): Vec3 {
  const rotated = mulMat3Vec(tr.rot, p);
  return [rotated[0] + tr.t[0], rotated[1] + tr.t[1], rotated[2] + tr.t[2]];
}

/** Lê um IfcAxis2Placement3D e monta a transformação local (rotação + translação) que ele representa. */
export function readAxis2Placement3D(model: StepModel, id: number): Transform {
  const args = getArgs(model, id);
  if (!args) return IDENTITY;
  const locationId = asRefId(args[0]);
  const locationArgs = locationId !== undefined ? getArgs(model, locationId) : undefined;
  const location = (locationArgs ? asVec3(locationArgs[0]) : undefined) ?? [0, 0, 0];
  const zRefArgs = args[1]?.k === 'ref' ? getArgs(model, args[1].id) : undefined;
  const zRef = zRefArgs ? asVec3(zRefArgs[0]) : undefined;
  const xRefArgs = args[2]?.k === 'ref' ? getArgs(model, args[2].id) : undefined;
  const xRef = xRefArgs ? asVec3(xRefArgs[0]) : undefined;
  const zAxis = norm(zRef ?? [0, 0, 1]);
  let xAxisRaw = xRef ?? [1, 0, 0];
  // ortogonaliza X em relação a Z (Gram-Schmidt)
  xAxisRaw = sub(xAxisRaw, scale(zAxis, dot(xAxisRaw, zAxis)));
  const xAxis = norm(dot(xAxisRaw, xAxisRaw) > 1e-9 ? xAxisRaw : [1, 0, 0]);
  const yAxis = cross(zAxis, xAxis);
  const rot: Mat3 = [
    [xAxis[0], yAxis[0], zAxis[0]],
    [xAxis[1], yAxis[1], zAxis[1]],
    [xAxis[2], yAxis[2], zAxis[2]],
  ];
  return { rot, t: location };
}

/** Resolve a transformação absoluta (mundo) de um IfcLocalPlacement, subindo a cadeia de pais. */
export function resolvePlacement(
  model: StepModel,
  localPlacementId: number,
  cache: Map<number, Transform> = new Map(),
): Transform {
  const cached = cache.get(localPlacementId);
  if (cached) return cached;

  const args = getArgs(model, localPlacementId);
  if (!args || getType(model, localPlacementId) !== 'IFCLOCALPLACEMENT') {
    return IDENTITY;
  }
  const relToId = args[0]?.k === 'ref' ? args[0].id : undefined;
  const relPlacementId = args[1]?.k === 'ref' ? args[1].id : undefined;

  const parent = relToId ? resolvePlacement(model, relToId, cache) : IDENTITY;
  const local = relPlacementId ? readAxis2Placement3D(model, relPlacementId) : IDENTITY;
  const world = composeTransform(parent, local);
  cache.set(localPlacementId, world);
  return world;
}
