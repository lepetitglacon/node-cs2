import { Room, Client, CloseCode } from "colyseus";
import { MyRoomState, Player, Target } from "./schema/MyRoomState.js";
import { applyMovement } from "../game/movement.js";
import { loadMap, type MeshGeometry, type ColliderDescriptor, type SpawnPoints, type SpawnPoint } from "../game/mapLoader.js";
import { createStrategy, type MatchStrategy } from "../game/matchStrategy.js";
import RAPIER from "@dimforge/rapier3d-compat";

const CAPSULE_HALF_HEIGHT = 0.6;
const CAPSULE_RADIUS = 0.25;
const BODY_Y_OFFSET = CAPSULE_HALF_HEIGHT + CAPSULE_RADIUS;
const EYE_HEIGHT = 1.7; // Doit matcher PlayerCamera.HEIGHT côté client, sinon les bullets partent à une hauteur ≠ de la caméra → impacts décalés sous le viseur
const MAX_RAY_DIST = 50;
const JUMP_VEL = 4;
// Marge sous les pieds pour considérer le joueur au sol (ray vers le bas).
const GROUND_RAY_MARGIN = 0.50;
const SHOOT_COOLDOWN = 100;
const BULLET_DAMAGE = 33;
const BURST_RESET_MS = 450;
const RELOAD_TIME_MS = 2500;
// Offsets approximatifs du bout du canon par rapport à l'œil (en mètres) pour les tracers
const MUZZLE_FORWARD = 0.45;
const MUZZLE_RIGHT = 0.12;
const MUZZLE_DOWN = 0.18;

// --- Quête d'entraînement ---
const FETCH_RADIUS = 1.6;
const STAND_RADIUS = 1.0;
const QUEST_SESSION_MS = 60_000;
const TARGET_SPAWN_MIN_MS = 500;
const TARGET_SPAWN_MAX_MS = 3000;
const TARGET_POINTS = 100;
// Délai avant retrait d'une cible touchée, le temps que le client joue la mort.
const TARGET_DESPAWN_MS = 2500;
const TARGET_HALF_X = 0.35;
const TARGET_HALF_Y = 0.9;
const TARGET_HALF_Z = 0.35;

// Offsets cumulatifs du pattern AK-47 (pitch = recul vertical, yaw = dérive horizontale)
const AK47_PATTERN: Array<{ pitch: number; yaw: number }> = [
  { pitch: 0.020, yaw:  0.000 },
  { pitch: 0.046, yaw:  0.003 },
  { pitch: 0.075, yaw:  0.008 },
  { pitch: 0.103, yaw:  0.016 },
  { pitch: 0.126, yaw:  0.025 },
  { pitch: 0.140, yaw:  0.028 },
  { pitch: 0.147, yaw:  0.025 },
  { pitch: 0.150, yaw:  0.015 },
  { pitch: 0.152, yaw:  0.000 },
  { pitch: 0.153, yaw: -0.013 },
  { pitch: 0.154, yaw: -0.025 },
  { pitch: 0.155, yaw: -0.032 },
  { pitch: 0.156, yaw: -0.027 },
  { pitch: 0.157, yaw: -0.013 },
  { pitch: 0.158, yaw:  0.000 },
  { pitch: 0.159, yaw:  0.012 },
  { pitch: 0.160, yaw:  0.020 },
  { pitch: 0.161, yaw:  0.017 },
  { pitch: 0.162, yaw:  0.007 },
  { pitch: 0.163, yaw: -0.005 },
  { pitch: 0.164, yaw: -0.010 },
  { pitch: 0.165, yaw: -0.007 },
  { pitch: 0.166, yaw:  0.000 },
  { pitch: 0.167, yaw:  0.007 },
  { pitch: 0.168, yaw:  0.010 },
  { pitch: 0.169, yaw:  0.007 },
  { pitch: 0.170, yaw:  0.000 },
  { pitch: 0.171, yaw: -0.007 },
  { pitch: 0.172, yaw: -0.007 },
  { pitch: 0.173, yaw:  0.000 },
];

function resolveDir(input: any): 'front' | 'back' | 'left' | 'right' | null {
  if (!input.forward && !input.back && !input.left && !input.right) return null;
  if (input.forward && !input.back) return 'front';
  if (input.back && !input.forward) return 'back';
  if (input.left && !input.right) return 'left';
  if (input.right && !input.left) return 'right';
  if (input.forward) return input.left ? 'left' : 'right';
  if (input.back) return input.left ? 'left' : 'right';
  return 'front';
}

export class MyRoom extends Room {
  state = new MyRoomState();
  strategy!: MatchStrategy;

  world!: RAPIER.World;
  mapGeometries: MeshGeometry[] = [];
  mapColliders: ColliderDescriptor[] = [];
  spawns!: SpawnPoints;
  playerBodies = new Map<string, RAPIER.RigidBody>();
  playerVelocities = new Map<string, { x: number; z: number }>();
  playerClients = new Map<string, Client>();
  pendingInputs = new Map<string, any>();
  colliderOwners = new Map<number, string>();
  playerColliderHandles = new Map<string, number>();
  playerLastShot = new Map<string, number>();
  playerBurstIndex = new Map<string, number>();
  playerReloadStart = new Map<string, number>();
  playerIsShooting = new Map<string, boolean>();
  playerShotPending = new Map<string, { yaw: number; pitch: number } | null>();

  // Quête d'entraînement
  fetchAk: SpawnPoint | null = null;
  stands: SpawnPoint[] = [];
  targetSpots: SpawnPoint[] = [];
  sessionStarted = false;
  sessionActive = false;
  sessionEndsAt = 0;
  nextTargetSpawnAt = 0;
  nextTargetId = 0;
  targetBodies = new Map<string, RAPIER.RigidBody>();
  targetColliderOwners = new Map<number, string>();
  targetSpotIndex = new Map<string, number>();
  occupiedSpots = new Set<number>();
  targetDespawnAt = new Map<string, number>();
  // Colliders de murs invisibles : ignorés par le raycast de tir.
  invisibleWallHandles = new Set<number>();

  async onCreate(options: any) {
    await RAPIER.init();

    this.strategy = createStrategy(this.state.mode);
    this.maxClients = this.strategy.maxClients;

    this.world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });

    const map = await loadMap(this.world, this.state.mapId);
    this.mapGeometries = map.geometries;
    this.mapColliders = map.colliders;
    this.spawns = map.spawns;
    this.fetchAk = map.fetchAk;
    this.stands = map.stands;
    this.targetSpots = map.targetSpots;
    this.invisibleWallHandles = new Set(map.invisibleColliderHandles);

    await this.setMetadata({
      mapId: this.state.mapId,
      mode: this.state.mode,
    });

    this.onMessage("requestDebugMesh", (client: Client) => {
      client.send("debugMapMesh", { geometries: this.mapGeometries, colliders: this.mapColliders });
    });
    this.onMessage("playerInput", (client: Client, message: any) => {
      this.pendingInputs.set(client.sessionId, message);
    });
    this.onMessage("shotStart", (client: Client, message: { yaw: number; pitch: number }) => {
      this.playerIsShooting.set(client.sessionId, true);
      this.playerShotPending.set(client.sessionId, message);
    });
    this.onMessage("shotEnd", (client: Client) => {
      this.playerIsShooting.set(client.sessionId, false);
    });
    this.onMessage("reload", (client: Client) => {
      const player = this.state.players.get(client.sessionId);
      if (!player || player.health <= 0) return;
      if (player.isReloading || player.totalAmmo <= 0 || player.bullets >= this.strategy.magazineSize) return;
      player.isReloading = true;
      this.playerReloadStart.set(client.sessionId, Date.now());
    });
    this.onMessage("respawn", (client: Client) => {
      const player = this.state.players.get(client.sessionId);
      if (!player || player.state !== 'dead') return;
      this.respawnPlayer(client.sessionId);
    });

    this.setSimulationInterval((dt) => this.update(dt), 1000 / 60);
  }

  update(_dt: number) {
    const now = Date.now();

    // Auto-respawn après respawnDelayMs
    if (this.strategy.respawnDelayMs !== null) {
      this.state.players.forEach((player, sessionId) => {
        if (player.state === 'dead' && player.respawnAt > 0 && now >= player.respawnAt) {
          this.respawnPlayer(sessionId);
        }
      });
    }

    // Complétion du rechargement
    this.playerReloadStart.forEach((startTime, sessionId) => {
      if (startTime === 0) return;
      if (now - startTime < RELOAD_TIME_MS) return;
      const player = this.state.players.get(sessionId);
      if (!player) return;
      const needed = this.strategy.magazineSize - player.bullets;
      const available = Math.min(needed, player.totalAmmo);
      player.bullets += available;
      player.totalAmmo -= available;
      player.isReloading = false;
      this.playerReloadStart.set(sessionId, 0);
    });

    // Réinitialise le burst si le joueur n'a pas tiré depuis BURST_RESET_MS
    this.playerBurstIndex.forEach((index, sessionId) => {
      if (index === 0) return;
      const lastShot = this.playerLastShot.get(sessionId) ?? 0;
      if (now - lastShot > BURST_RESET_MS) {
        this.playerBurstIndex.set(sessionId, 0);
      }
    });

    this.pendingInputs.forEach((input, sessionId) => {
      const body = this.playerBodies.get(sessionId);
      const player = this.state.players.get(sessionId);
      if (!body || !player) return;

      if (player.health <= 0) {
        if (player.moveState !== 'dying') player.moveState = 'dying';
        return;
      }

      const vel = this.playerVelocities.get(sessionId)!;
      applyMovement(vel, input, input.yaw);
      this.playerVelocities.set(sessionId, vel);

      const dir = resolveDir(input);
      let newMoveState: import("./schema/MyRoomState.js").MoveState = 'idle';
      if (input.jump) {
        newMoveState = 'jump';
      } else if (input.sprint && dir) {
        newMoveState = `sprint_${dir}` as import("./schema/MyRoomState.js").MoveState;
      } else if (input.crouch) {
        newMoveState = dir ? `crouch_${dir}` as import("./schema/MyRoomState.js").MoveState : 'crouch_idle';
      } else if (dir) {
        newMoveState = `walk_${dir}` as import("./schema/MyRoomState.js").MoveState;
      }

      if (player.moveState !== newMoveState) player.moveState = newMoveState;

      const linvel = body.linvel();
      const grounded = this.isGrounded(body);
      player.grounded = grounded;

      if (grounded) {
        // Au sol : déplacement piloté par les inputs (+ saut éventuel).
        const y = input.jump ? JUMP_VEL : linvel.y;
        body.setLinvel({ x: vel.x * 64, y, z: vel.z * 64 }, true);
      }
      // En l'air : on ne touche pas à la vélocité → le momentum du saut est conservé.

      const { yaw, pitch } = input;
      const cy = Math.cos(yaw / 2), sy = Math.sin(yaw / 2);
      const cp = Math.cos(pitch / 2), sp = Math.sin(pitch / 2);
      player.qx = cy * sp;
      player.qy = sy * cp;
      player.qz = -sy * sp;
      player.qw = cy * cp;

      const isShooting = this.playerIsShooting.get(sessionId) ?? false;
      const pending = this.playerShotPending.get(sessionId) ?? null;
      if ((pending || isShooting) && !player.isReloading && player.bullets > 0 && player.weapons.length > 0) {
        const lastShot = this.playerLastShot.get(sessionId) ?? 0;
        if (now - lastShot >= SHOOT_COOLDOWN) {
          if (pending) this.playerShotPending.set(sessionId, null);
          this.fireShot(sessionId, player, body, pending?.yaw ?? yaw, pending?.pitch ?? pitch, now);
        }
      }
    });

    this.world.step();

    this.playerBodies.forEach((body, sessionId) => {
      const player = this.state.players.get(sessionId);
      const vel = this.playerVelocities.get(sessionId);
      if (!player || !vel) return;

      const pos = body.translation();
      player.x = pos.x;
      player.y = pos.y - BODY_Y_OFFSET;
      player.z = pos.z;
      player.headY = pos.y + (EYE_HEIGHT - BODY_Y_OFFSET);
    });

    this.questUpdate(now);
  }

  // Au sol : ray vers le bas depuis le centre du body + vitesse verticale non montante
  // (évite le re-saut à l'apex où linvel.y ≈ 0 mais le joueur est en l'air).
  private isGrounded(body: RAPIER.RigidBody): boolean {
    const t = body.translation();
    const ray = new RAPIER.Ray({ x: t.x, y: t.y, z: t.z }, { x: 0, y: -1, z: 0 });
    const hit = this.world.castRay(
      ray,
      BODY_Y_OFFSET + GROUND_RAY_MARGIN,
      true,
      undefined,
      undefined,
      undefined,
      body,
    );
    return hit !== null;
  }

  private fireShot(sessionId: string, player: Player, body: RAPIER.RigidBody, yaw: number, pitch: number, now: number) {
    if (player.isReloading || player.bullets <= 0) return;
    this.playerLastShot.set(sessionId, now);
    player.bullets -= 1;
    if (player.bullets === 0 && player.totalAmmo > 0) {
      player.isReloading = true;
      this.playerReloadStart.set(sessionId, now);
    }

    const pos = body.translation();
    const headY = pos.y + (EYE_HEIGHT - BODY_Y_OFFSET);
    const dirX = Math.sin(yaw) * Math.cos(pitch);
    const dirY = -Math.sin(pitch);
    const dirZ = Math.cos(yaw) * Math.cos(pitch);
    const rgtX = Math.cos(yaw);
    const rgtZ = -Math.sin(yaw);
    const muzzleX = pos.x + dirX * MUZZLE_FORWARD + rgtX * MUZZLE_RIGHT;
    const muzzleY = headY + dirY * MUZZLE_FORWARD - MUZZLE_DOWN;
    const muzzleZ = pos.z + dirZ * MUZZLE_FORWARD + rgtZ * MUZZLE_RIGHT;
    const ray = new RAPIER.Ray({ x: pos.x, y: headY, z: pos.z }, { x: dirX, y: dirY, z: dirZ });
    const hit = this.world.castRayAndGetNormal(
      ray,
      MAX_RAY_DIST,
      false,
      undefined,
      undefined,
      undefined,
      body,
      (collider: RAPIER.Collider) => !this.invisibleWallHandles.has(collider.handle),
    );

    let hitOwnerId: string | undefined;
    let hitData: { x: number; y: number; z: number; nx: number; ny: number; nz: number; onPlayer: boolean } | null = null;
    if (hit) {
      hitOwnerId = this.colliderOwners.get(hit.collider.handle);
      hitData = {
        x: pos.x + dirX * hit.timeOfImpact,
        y: headY + dirY * hit.timeOfImpact,
        z: pos.z + dirZ * hit.timeOfImpact,
        nx: hit.normal.x,
        ny: hit.normal.y,
        nz: hit.normal.z,
        onPlayer: !!hitOwnerId,
      };

      if (hitOwnerId) {
        const target = this.state.players.get(hitOwnerId);
        if (target && target.health > 0 && this.strategy.canDamage(player, target)) {
          target.health = Math.max(0, target.health - BULLET_DAMAGE);
          if (target.health === 0) {
            this.killPlayer(hitOwnerId, target, player, now);
          }
        }
      } else {
        const targetId = this.targetColliderOwners.get(hit.collider.handle);
        if (targetId && player.questStep === 'shoot_targets') {
          const questTarget = this.state.targets.get(targetId);
          if (questTarget && questTarget.active) {
            questTarget.active = false;
            this.detachTargetCollider(targetId);
            this.targetDespawnAt.set(targetId, now + TARGET_DESPAWN_MS);
            player.score += TARGET_POINTS;
          }
        }
      }
    }

    const burstIndex = this.playerBurstIndex.get(sessionId) ?? 0;
    this.playerClients.get(sessionId)?.send('recoil', AK47_PATTERN[Math.min(burstIndex, AK47_PATTERN.length - 1)]);
    this.playerBurstIndex.set(sessionId, burstIndex + 1);

    this.broadcast('shotFired', {
      sessionId,
      x: pos.x, y: headY, z: pos.z,         // origine (œil) — utilisée pour le son spatial
      mx: muzzleX, my: muzzleY, mz: muzzleZ, // bout du canon — utilisé pour le tracer
      hit: hitData,
    });
  }

  private killPlayer(victimId: string, victim: Player, killer: Player | null, now: number) {
    victim.state = 'dead';
    victim.isReloading = false;
    this.playerReloadStart.set(victimId, 0);
    this.playerIsShooting.set(victimId, false);
    this.playerShotPending.set(victimId, null);
    this.strategy.onKill(killer, victim);
    if (this.strategy.respawnDelayMs !== null) {
      victim.respawnAt = now + this.strategy.respawnDelayMs;
    }
  }

  private respawnPlayer(sessionId: string) {
    const player = this.state.players.get(sessionId);
    const body = this.playerBodies.get(sessionId);
    if (!player || !body) return;

    const spawn = this.strategy.pickSpawn(player.team, this.spawns);
    body.setTranslation({ x: spawn.x, y: spawn.y + BODY_Y_OFFSET + 0.5, z: spawn.z }, true);
    body.setLinvel({ x: 0, y: 0, z: 0 }, true);

    player.state = 'alive';
    player.health = this.strategy.startingHealth;
    player.bullets = this.strategy.magazineSize;
    player.totalAmmo = this.strategy.maxTotalAmmo;
    player.isReloading = false;
    player.respawnAt = 0;
    player.moveState = 'idle';
    this.playerReloadStart.set(sessionId, 0);
    this.playerVelocities.set(sessionId, { x: 0, z: 0 });
  }

  private horizDistSq(ax: number, az: number, bx: number, bz: number): number {
    const dx = ax - bx, dz = az - bz;
    return dx * dx + dz * dz;
  }

  private questUpdate(now: number) {
    this.state.players.forEach((player) => {
      if (player.questStep === 'fetch_weapon') {
        if (
          this.fetchAk &&
          this.horizDistSq(player.x, player.z, this.fetchAk.x, this.fetchAk.z) <
            FETCH_RADIUS * FETCH_RADIUS
        ) {
          if (!player.weapons.includes('ak47')) player.weapons.push('ak47');
          player.bullets = this.strategy.magazineSize;
          player.totalAmmo = this.strategy.maxTotalAmmo;
          player.questStep = 'go_to_stand';
        }
      } else if (player.questStep === 'go_to_stand') {
        const onStand = this.stands.some(
          (s) =>
            this.horizDistSq(player.x, player.z, s.x, s.z) <
            STAND_RADIUS * STAND_RADIUS,
        );
        if (onStand) {
          player.questStep = 'shoot_targets';
          this.startSession(now);
        }
      }
    });

    if (this.sessionActive) {
      if (now >= this.sessionEndsAt) {
        this.endSession();
      } else if (now >= this.nextTargetSpawnAt) {
        this.spawnTarget();
        this.scheduleNextSpawn(now);
      }
    }

    this.targetDespawnAt.forEach((at, id) => {
      if (now >= at) this.removeTarget(id);
    });
  }

  private startSession(now: number) {
    if (this.sessionStarted) return;
    this.sessionStarted = true;
    this.sessionActive = true;
    this.sessionEndsAt = now + QUEST_SESSION_MS;
    this.scheduleNextSpawn(now);
  }

  private scheduleNextSpawn(now: number) {
    const delay =
      TARGET_SPAWN_MIN_MS +
      Math.random() * (TARGET_SPAWN_MAX_MS - TARGET_SPAWN_MIN_MS);
    this.nextTargetSpawnAt = now + delay;
  }

  private spawnTarget() {
    const freeIndices: number[] = [];
    for (let i = 0; i < this.targetSpots.length; i++) {
      if (!this.occupiedSpots.has(i)) freeIndices.push(i);
    }
    if (freeIndices.length === 0) return;

    const idx = freeIndices[Math.floor(Math.random() * freeIndices.length)];
    const spot = this.targetSpots[idx];
    const id = `t${this.nextTargetId++}`;

    const target = new Target();
    target.x = spot.x;
    target.y = spot.y;
    target.z = spot.z;
    target.active = true;
    this.state.targets.set(id, target);

    const bodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(
      spot.x,
      spot.y + TARGET_HALF_Y,
      spot.z,
    );
    const body = this.world.createRigidBody(bodyDesc);
    const collider = this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(TARGET_HALF_X, TARGET_HALF_Y, TARGET_HALF_Z),
      body,
    );
    this.targetBodies.set(id, body);
    this.targetColliderOwners.set(collider.handle, id);
    this.targetSpotIndex.set(id, idx);
    this.occupiedSpots.add(idx);
  }

  // Retire le collider physique (plus touchable) sans retirer le Target du state.
  private detachTargetCollider(id: string) {
    const body = this.targetBodies.get(id);
    if (!body) return;
    const collider = body.collider(0);
    if (collider) this.targetColliderOwners.delete(collider.handle);
    this.world.removeRigidBody(body);
    this.targetBodies.delete(id);
  }

  private removeTarget(id: string) {
    this.detachTargetCollider(id);
    const idx = this.targetSpotIndex.get(id);
    if (idx !== undefined) {
      this.occupiedSpots.delete(idx);
      this.targetSpotIndex.delete(id);
    }
    this.targetDespawnAt.delete(id);
    this.state.targets.delete(id);
  }

  private endSession() {
    this.sessionActive = false;
    for (const id of [...this.state.targets.keys()]) {
      this.removeTarget(id);
    }
    this.state.players.forEach((player) => {
      if (player.questStep === 'shoot_targets') player.questStep = 'done';
    });
  }

  onAuth(client: Client, options: any, context: any) {
    return true;
  }

  onJoin(client: Client, options: any) {
    console.log(client.sessionId, "joined!");

    const team = this.strategy.assignTeam(this.state);
    const spawn = this.strategy.pickSpawn(team, this.spawns);

    const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(spawn.x, spawn.y + BODY_Y_OFFSET + 0.5, spawn.z)
      .lockRotations();
    const body = this.world.createRigidBody(bodyDesc);
    const collider = this.world.createCollider(
      RAPIER.ColliderDesc.capsule(CAPSULE_HALF_HEIGHT, CAPSULE_RADIUS),
      body,
    );
    this.colliderOwners.set(collider.handle, client.sessionId);
    this.playerColliderHandles.set(client.sessionId, collider.handle);

    const player = new Player();
    player.team = team;
    player.x = spawn.x;
    player.y = spawn.y;
    player.z = spawn.z;
    player.health = this.strategy.startingHealth;
    // Pas d'arme par défaut : le joueur doit la récupérer via la quête.
    player.bullets = 0;
    player.totalAmmo = 0;

    this.playerBodies.set(client.sessionId, body);
    this.playerVelocities.set(client.sessionId, { x: 0, z: 0 });
    this.playerClients.set(client.sessionId, client);
    this.playerLastShot.set(client.sessionId, 0);
    this.playerBurstIndex.set(client.sessionId, 0);
    this.playerReloadStart.set(client.sessionId, 0);
    this.playerIsShooting.set(client.sessionId, false);
    this.playerShotPending.set(client.sessionId, null);
    this.state.players.set(client.sessionId, player);
  }

  onLeave(client: Client, code: CloseCode) {
    const body = this.playerBodies.get(client.sessionId);
    if (body) this.world.removeRigidBody(body);

    const handle = this.playerColliderHandles.get(client.sessionId);
    if (handle !== undefined) this.colliderOwners.delete(handle);
    this.playerColliderHandles.delete(client.sessionId);
    this.playerLastShot.delete(client.sessionId);
    this.playerBurstIndex.delete(client.sessionId);
    this.playerReloadStart.delete(client.sessionId);
    this.playerIsShooting.delete(client.sessionId);
    this.playerShotPending.delete(client.sessionId);
    this.playerClients.delete(client.sessionId);
    this.playerBodies.delete(client.sessionId);
    this.playerVelocities.delete(client.sessionId);
    this.pendingInputs.delete(client.sessionId);
    this.state.players.delete(client.sessionId);

    console.log(client.sessionId, "left!", code);
  }

  onDispose() {
    console.log("room", this.roomId, "disposing...");
  }
}
