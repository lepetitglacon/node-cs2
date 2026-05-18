import { Room, Client, CloseCode } from "colyseus";
import { MyRoomState, Player } from "./schema/MyRoomState.js";
import { applyMovement } from "../game/movement.js";
import { loadMap, type MeshGeometry, type ColliderDescriptor, type SpawnPoints } from "../game/mapLoader.js";
import { createStrategy, type MatchStrategy } from "../game/matchStrategy.js";
import RAPIER from "@dimforge/rapier3d-compat";

const CAPSULE_HALF_HEIGHT = 0.6;
const CAPSULE_RADIUS = 0.25;
const BODY_Y_OFFSET = CAPSULE_HALF_HEIGHT + CAPSULE_RADIUS;
const EYE_HEIGHT = 1.7; // Doit matcher PlayerCamera.HEIGHT côté client, sinon les bullets partent à une hauteur ≠ de la caméra → impacts décalés sous le viseur
const MAX_RAY_DIST = 50;
const SHOOT_COOLDOWN = 100;
const BULLET_DAMAGE = 33;
const BURST_RESET_MS = 450;
const RELOAD_TIME_MS = 2500;
// Offsets approximatifs du bout du canon par rapport à l'œil (en mètres) pour les tracers
const MUZZLE_FORWARD = 0.45;
const MUZZLE_RIGHT = 0.12;
const MUZZLE_DOWN = 0.18;

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

  async onCreate(options: any) {
    await RAPIER.init();

    this.strategy = createStrategy(this.state.mode);
    this.maxClients = this.strategy.maxClients;

    this.world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });

    const map = await loadMap(this.world, this.state.mapId);
    this.mapGeometries = map.geometries;
    this.mapColliders = map.colliders;
    this.spawns = map.spawns;

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

      if (input.jump && Math.abs(linvel.y) < 0.5) {
        body.setLinvel({ x: vel.x * 64, y: 6, z: vel.z * 64 }, true);
      } else {
        body.setLinvel({ x: vel.x * 64, y: linvel.y, z: vel.z * 64 }, true);
      }

      const { yaw, pitch } = input;
      const cy = Math.cos(yaw / 2), sy = Math.sin(yaw / 2);
      const cp = Math.cos(pitch / 2), sp = Math.sin(pitch / 2);
      player.qx = cy * sp;
      player.qy = sy * cp;
      player.qz = -sy * sp;
      player.qw = cy * cp;

      const isShooting = this.playerIsShooting.get(sessionId) ?? false;
      const pending = this.playerShotPending.get(sessionId) ?? null;
      if ((pending || isShooting) && !player.isReloading && player.bullets > 0) {
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
    const hit = this.world.castRayAndGetNormal(ray, MAX_RAY_DIST, false, undefined, undefined, undefined, body);

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
    player.bullets = this.strategy.magazineSize;
    player.totalAmmo = this.strategy.maxTotalAmmo;

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
