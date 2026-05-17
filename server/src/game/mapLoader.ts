import { NodeIO } from "@gltf-transform/core";
import path from "node:path";
import { fileURLToPath } from "node:url";
import RAPIER from "@dimforge/rapier3d-compat";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export type ShapeType = "trimesh" | "cuboid" | "cylinder" | "ball" | "none";

// Mapping nom d'objet Blender → type de shape Rapier.
// "none" = objet purement visuel, aucun collider créé.
export const MESH_SHAPE_MAP: Record<string, ShapeType> = {
  Plane: "trimesh",
  Weird: "trimesh",
  Cube: "cuboid",
};

// Convention de nommage Blender pour les spawn points :
// objet (Empty ou mesh) dont le nom commence par "spawn_t1" ou "spawn_t2"
// (insensible à la casse). Exemples : Spawn_t1, Spawn_t1.001, spawn_t2_a.
function matchesSpawnPrefix(nodeName: string, team: 't1' | 't2'): boolean {
  const lower = nodeName.toLowerCase();
  const prefix = `spawn_${team}`;
  return lower === prefix
    || lower.startsWith(`${prefix}.`)
    || lower.startsWith(`${prefix}_`);
}

function transformPositions(raw: Float32Array, mat: number[]): Float32Array {
  const out = new Float32Array(raw.length);
  for (let i = 0; i < raw.length; i += 3) {
    const x = raw[i], y = raw[i + 1], z = raw[i + 2];
    out[i]     =  (mat[0]*x + mat[4]*y + mat[8]*z  + mat[12]);
    out[i + 1] =  (mat[1]*x + mat[5]*y + mat[9]*z  + mat[13]);
    out[i + 2] = -(mat[2]*x + mat[6]*y + mat[10]*z + mat[14]);
  }
  return out;
}

function computeBounds(positions: Float32Array) {
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (let i = 0; i < positions.length; i += 3) {
    if (positions[i]     < minX) minX = positions[i];
    if (positions[i]     > maxX) maxX = positions[i];
    if (positions[i + 1] < minY) minY = positions[i + 1];
    if (positions[i + 1] > maxY) maxY = positions[i + 1];
    if (positions[i + 2] < minZ) minZ = positions[i + 2];
    if (positions[i + 2] > maxZ) maxZ = positions[i + 2];
  }
  return {
    center: { x: (minX + maxX) / 2, y: (minY + maxY) / 2, z: (minZ + maxZ) / 2 },
    half:   { x: (maxX - minX) / 2, y: (maxY - minY) / 2, z: (maxZ - minZ) / 2 },
  };
}

function addCollider(
  world: RAPIER.World,
  shapeType: ShapeType,
  positions: Float32Array,
  indices: Uint32Array,
): void {
  if (shapeType === "none") return;

  if (shapeType === "trimesh") {
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    world.createCollider(RAPIER.ColliderDesc.trimesh(positions, indices), body);
    return;
  }

  const { center, half } = computeBounds(positions);
  const bodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(center.x, center.y, center.z);
  const body = world.createRigidBody(bodyDesc);

  switch (shapeType) {
    case "cuboid":
      world.createCollider(RAPIER.ColliderDesc.cuboid(half.x, half.y, half.z), body);
      break;
    case "cylinder":
      world.createCollider(RAPIER.ColliderDesc.cylinder(half.y, Math.max(half.x, half.z)), body);
      break;
    case "ball":
      world.createCollider(RAPIER.ColliderDesc.ball(Math.max(half.x, half.y, half.z)), body);
      break;
  }
}

export interface MeshGeometry {
  positions: number[];
  indices: number[];
}

export interface SpawnPoint {
  x: number;
  y: number;
  z: number;
}

export interface SpawnPoints {
  team1: SpawnPoint[];
  team2: SpawnPoint[];
}

export interface MapData {
  geometries: MeshGeometry[];
  spawns: SpawnPoints;
}

export async function loadMap(world: RAPIER.World, mapId: string): Promise<MapData> {
  const io = new NodeIO();
  
  // Use process.cwd() to get the root of the server directory
  const glbPath = path.resolve(process.cwd(), "public/assets/map", `${mapId}.glb`);
  
  const document = await io.read(glbPath);
  const geometries: MeshGeometry[] = [];
  const spawns: SpawnPoints = { team1: [], team2: [] };

  for (const node of document.getRoot().listNodes()) {
    const mat = node.getMatrix();
    const nodeName = node.getName();

    // Spawn points : on extrait la translation du node, peu importe qu'il ait un mesh ou pas
    // (les Empties Blender deviennent des nodes sans mesh).
    if (matchesSpawnPrefix(nodeName, 't1')) {
      spawns.team1.push({ x: mat[12], y: mat[13], z: -mat[14] });
      continue;
    }
    if (matchesSpawnPrefix(nodeName, 't2')) {
      spawns.team2.push({ x: mat[12], y: mat[13], z: -mat[14] });
      continue;
    }

    const mesh = node.getMesh();
    if (!mesh) continue;

    const shapeType = MESH_SHAPE_MAP[nodeName.split('.')[0]] ?? "none";
    if (shapeType === "none") continue;

    for (const prim of mesh.listPrimitives()) {
      const posAttr = prim.getAttribute("POSITION");
      const idxAttr = prim.getIndices();
      if (!posAttr) continue;

      const rawPos = posAttr.getArray() as Float32Array;
      const positions = transformPositions(rawPos, mat);

      let indices: Uint32Array;
      if (idxAttr) {
        const raw = idxAttr.getArray()!;
        indices = raw instanceof Uint32Array ? raw : new Uint32Array(raw);
      } else {
        indices = new Uint32Array(rawPos.length / 3);
        for (let i = 0; i < indices.length; i++) indices[i] = i;
      }

      addCollider(world, shapeType, positions, indices);

      if (shapeType === "trimesh") {
        geometries.push({
          positions: Array.from(positions),
          indices: Array.from(indices),
        });
      }
    }
  }

  return { geometries, spawns };
}
