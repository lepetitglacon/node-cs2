import { NodeIO } from "@gltf-transform/core";
import path from "node:path";
import { fileURLToPath } from "node:url";
import RAPIER from "@dimforge/rapier3d-compat";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export type ShapeType = "trimesh" | "cuboid" | "cylinder" | "ball" | "none";

// Mapping nom de mesh → type de shape Rapier.
// "none" = mesh purement visuelle, aucun collider créé.
export const MESH_SHAPE_MAP: Record<string, ShapeType> = {
  Plane: "trimesh",
};

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

export async function loadMapColliders(world: RAPIER.World, mapId: string): Promise<MeshGeometry[]> {
  const io = new NodeIO();
  const glbPath = path.resolve(__dirname, "../../public/assets/map", `${mapId}.glb`);
  const document = await io.read(glbPath);
  const geometries: MeshGeometry[] = [];

  for (const node of document.getRoot().listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;

    const shapeType = MESH_SHAPE_MAP[mesh.getName()] ?? "none";
    if (shapeType === "none") continue;

    const mat = node.getMatrix();

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

  return geometries;
}
