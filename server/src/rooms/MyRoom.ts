import { Room, Client, CloseCode } from "colyseus";
import { MyRoomState, Player } from "./schema/MyRoomState.js";
import { applyMovement } from "../game/movement.js";
import { loadMapColliders, type MeshGeometry } from "../game/mapLoader.js";
import RAPIER from "@dimforge/rapier3d-compat";

const FLOOR_SIZE = 10;
const CAPSULE_HALF_HEIGHT = 0.6;
const CAPSULE_RADIUS = 0.25;
const BODY_Y_OFFSET = CAPSULE_HALF_HEIGHT + CAPSULE_RADIUS;
const EYE_HEIGHT = 1.60;
const MAX_RAY_DIST = 50;
const SHOOT_COOLDOWN = 100;
const BULLET_DAMAGE = 10;
const BURST_RESET_MS = 450;
const MAGAZINE_SIZE = 30;
const MAX_TOTAL_AMMO = 90;
const RELOAD_TIME_MS = 2500;

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

export class MyRoom extends Room {
  maxClients = 4;
  state = new MyRoomState();

  world!: RAPIER.World;
  mapGeometries: MeshGeometry[] = [];
  playerBodies = new Map<string, RAPIER.RigidBody>();
  playerVelocities = new Map<string, { x: number; z: number }>();
  playerClients = new Map<string, Client>();
  pendingInputs = new Map<string, any>();
  colliderOwners = new Map<number, string>();
  playerColliderHandles = new Map<string, number>();
  playerLastShot = new Map<string, number>();
  playerBurstIndex = new Map<string, number>();
  playerReloadStart = new Map<string, number>();

  async onCreate(options: any) {
    await RAPIER.init();

    this.world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });

    this.mapGeometries = await loadMapColliders(this.world, this.state.mapId);

    this.onMessage("requestDebugMesh", (client: Client) => {
      client.send("debugMapMesh", this.mapGeometries);
    });
    this.onMessage("playerInput", (client: Client, message: any) => {
      this.pendingInputs.set(client.sessionId, message);
    });
    this.onMessage("reload", (client: Client) => {
      const player = this.state.players.get(client.sessionId);
      if (!player || player.health <= 0) return;
      if (player.isReloading || player.totalAmmo <= 0 || player.bullets >= MAGAZINE_SIZE) return;
      player.isReloading = true;
      this.playerReloadStart.set(client.sessionId, Date.now());
    });
    this.onMessage("respawn", (client: Client) => {
      const player = this.state.players.get(client.sessionId);
      if (!player || player.state === 'alive') return;
      player.state = 'alive';
      player.health = 100;
      player.bullets = MAGAZINE_SIZE;
      player.totalAmmo = MAX_TOTAL_AMMO;
      player.isReloading = false;
      this.playerReloadStart.set(client.sessionId, 0);
    });

    this.setSimulationInterval((dt) => this.update(dt), 1000 / 60);
  }

  update(_dt: number) {
    const now = Date.now();

    // Complétion du rechargement
    this.playerReloadStart.forEach((startTime, sessionId) => {
      if (startTime === 0) return;
      if (now - startTime < RELOAD_TIME_MS) return;
      const player = this.state.players.get(sessionId);
      if (!player) return;
      const needed = MAGAZINE_SIZE - player.bullets;
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

      let newMoveState: import("./schema/MyRoomState.js").MoveState = 'idle';
      if (input.forward || input.back || input.left || input.right) {
        if (input.forward && !input.back) {
          newMoveState = 'walk_front';
        } else if (input.back && !input.forward) {
          newMoveState = 'walk_back';
        } else if (input.left && !input.right) {
          newMoveState = 'walk_left';
        } else if (input.right && !input.left) {
          newMoveState = 'walk_right';
        } else if (input.forward && (input.left || input.right)) {
          newMoveState = input.left ? 'walk_left' : 'walk_right';
        } else if (input.back && (input.left || input.right)) {
          newMoveState = input.left ? 'walk_left' : 'walk_right';
        }
      }

      if (player.moveState !== newMoveState) player.moveState = newMoveState;

      const linvel = body.linvel();
      body.setLinvel({ x: vel.x * 64, y: linvel.y, z: vel.z * 64 }, true);

      const { yaw, pitch } = input;
      const cy = Math.cos(yaw / 2), sy = Math.sin(yaw / 2);
      const cp = Math.cos(pitch / 2), sp = Math.sin(pitch / 2);
      player.qx = cy * sp;
      player.qy = sy * cp;
      player.qz = -sy * sp;
      player.qw = cy * cp;

      const wantsShoot = input.shoot;
      input.shoot = false;

      if (wantsShoot && !player.isReloading && player.bullets > 0) {
        const lastShot = this.playerLastShot.get(sessionId) ?? 0;
        if (now - lastShot >= SHOOT_COOLDOWN) {
          this.playerLastShot.set(sessionId, now);
          player.bullets -= 1;
          if (player.bullets === 0 && player.totalAmmo > 0) {
            player.isReloading = true;
            this.playerReloadStart.set(sessionId, now);
          }

          // Raycast
          const pos = body.translation();
          const headY = pos.y + (EYE_HEIGHT - BODY_Y_OFFSET);
          const dirX = Math.sin(yaw) * Math.cos(pitch);
          const dirY = -Math.sin(pitch);
          const dirZ = Math.cos(yaw) * Math.cos(pitch);
          const ray = new RAPIER.Ray(
            { x: pos.x, y: headY, z: pos.z },
            { x: dirX, y: dirY, z: dirZ }
          );
          const hit = this.world.castRay(ray, MAX_RAY_DIST, false, undefined, undefined, undefined, body);

          if (hit) {
            const hitOwnerId = this.colliderOwners.get(hit.collider.handle);
            if (hitOwnerId) {
              const target = this.state.players.get(hitOwnerId);
              if (target) target.health = Math.max(0, target.health - BULLET_DAMAGE);
            }
          }

          // Envoie l'offset du pattern au client
          const burstIndex = this.playerBurstIndex.get(sessionId) ?? 0;
          const recoil = AK47_PATTERN[Math.min(burstIndex, AK47_PATTERN.length - 1)];
          this.playerClients.get(sessionId)?.send('recoil', recoil);
          this.playerBurstIndex.set(sessionId, burstIndex + 1);
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

      if (player.health <= 0) player.state = 'dead';
    });
  }

  onAuth(client: Client, options: any, context: any) {
    return true;
  }

  onJoin(client: Client, options: any) {
    console.log(client.sessionId, "joined!");

    const spawnX = -(FLOOR_SIZE / 2) + Math.random() * FLOOR_SIZE;
    const spawnZ = -(FLOOR_SIZE / 2) + Math.random() * FLOOR_SIZE;

    const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(spawnX, BODY_Y_OFFSET + 0.5, spawnZ)
      .lockRotations();
    const body = this.world.createRigidBody(bodyDesc);
    const collider = this.world.createCollider(
      RAPIER.ColliderDesc.capsule(CAPSULE_HALF_HEIGHT, CAPSULE_RADIUS),
      body,
    );
    this.colliderOwners.set(collider.handle, client.sessionId);
    this.playerColliderHandles.set(client.sessionId, collider.handle);

    const player = new Player();
    player.x = spawnX;
    player.y = 0;
    player.z = spawnZ;

    this.playerBodies.set(client.sessionId, body);
    this.playerVelocities.set(client.sessionId, { x: 0, z: 0 });
    this.playerClients.set(client.sessionId, client);
    this.playerLastShot.set(client.sessionId, 0);
    this.playerBurstIndex.set(client.sessionId, 0);
    this.playerReloadStart.set(client.sessionId, 0);
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
