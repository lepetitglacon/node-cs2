import { Room, Client, CloseCode } from "colyseus";
import { MyRoomState, Player } from "./schema/MyRoomState.js";
import { applyMovement } from "../game/movement.js";
import RAPIER from "@dimforge/rapier3d-compat";

const FLOOR_SIZE = 10;
const CAPSULE_HALF_HEIGHT = 0.6;
const CAPSULE_RADIUS = 0.25;
const BODY_Y_OFFSET = CAPSULE_HALF_HEIGHT + CAPSULE_RADIUS;
const EYE_HEIGHT = 1.60;
const MAX_RAY_DIST = 50;
const SHOOT_COOLDOWN = 500;
const BULLET_DAMAGE = 10;

export class MyRoom extends Room {
  maxClients = 4;
  state = new MyRoomState();

  world!: RAPIER.World;
  playerBodies = new Map<string, RAPIER.RigidBody>();
  playerVelocities = new Map<string, { x: number; z: number }>();
  pendingInputs = new Map<string, any>();
  colliderOwners = new Map<number, string>();
  playerColliderHandles = new Map<string, number>();
  playerLastShot = new Map<string, number>();

  async onCreate(options: any) {
    await RAPIER.init();

    this.world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });

    // Sol statique
    const groundBody = this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(FLOOR_SIZE, 0.05, FLOOR_SIZE),
      groundBody,
    );

    this.onMessage("playerInput", (client: Client, message: any) => {
      this.pendingInputs.set(client.sessionId, message);
    });
    this.onMessage("respawn", (client: Client, message: any) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return
      if (player.state === 'alive') return
      player.state = 'alive';
      player.health = 100
    });

    this.setSimulationInterval((dt) => this.update(dt), 1000 / 60);
  }

  update(_dt: number) {
    this.pendingInputs.forEach((input, sessionId) => {
      const body = this.playerBodies.get(sessionId);
      const player = this.state.players.get(sessionId);
      if (!body || !player) return;

      const vel = this.playerVelocities.get(sessionId)!;
      applyMovement(vel, input, input.yaw);
      this.playerVelocities.set(sessionId, vel);

      // Conserver la vélocité Y de Rapier (gravité) et écraser X/Z
      const linvel = body.linvel();
      body.setLinvel({ x: vel.x * 64, y: linvel.y, z: vel.z * 64 }, true);

      // Rotation depuis le yaw/pitch du client
      const { yaw, pitch } = input;
      const cy = Math.cos(yaw / 2), sy = Math.sin(yaw / 2);
      const cp = Math.cos(pitch / 2), sp = Math.sin(pitch / 2);
      player.qx = cy * sp;
      player.qy = sy * cp;
      player.qz = -sy * sp;
      player.qw = cy * cp;

      // Raycast depuis la tête dans la direction du regard
      const pos = body.translation();
      const headY = pos.y + (EYE_HEIGHT - BODY_Y_OFFSET);
      const dirX = Math.sin(yaw) * Math.cos(pitch);
      const dirY = -Math.sin(pitch);
      const dirZ = Math.cos(yaw) * Math.cos(pitch);
      const ray = new RAPIER.Ray({ x: pos.x, y: headY, z: pos.z }, { x: dirX, y: dirY, z: dirZ });
      const hit = this.world.castRay(ray, MAX_RAY_DIST, false, undefined, undefined, undefined, body);

      if (input.shoot) {
        const now = Date.now();
        const lastShot = this.playerLastShot.get(sessionId) ?? 0;
        if (now - lastShot >= SHOOT_COOLDOWN) {
          this.playerLastShot.set(sessionId, now);
          if (hit) {
            const hitOwnerId = this.colliderOwners.get(hit.collider.handle);
            if (hitOwnerId) {
              const target = this.state.players.get(hitOwnerId);
              if (target) target.health = Math.max(0, target.health - BULLET_DAMAGE);
            }
          }
        }
      }
    });

    this.world.step();

    // Sync positions Rapier → Schema
    this.playerBodies.forEach((body, sessionId) => {
      const player = this.state.players.get(sessionId);
      if (!player) return;
      const pos = body.translation();
      player.x = pos.x;
      player.y = pos.y - BODY_Y_OFFSET;
      player.z = pos.z;
      player.headY = pos.y + (EYE_HEIGHT - BODY_Y_OFFSET);

      // check for dead state
      if (player.health <= 0) {
        player.state = 'dead'
      }
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
    this.playerLastShot.set(client.sessionId, 0);
    this.state.players.set(client.sessionId, player);
  }

  onLeave(client: Client, code: CloseCode) {
    const body = this.playerBodies.get(client.sessionId);
    if (body) this.world.removeRigidBody(body);

    const handle = this.playerColliderHandles.get(client.sessionId);
    if (handle !== undefined) this.colliderOwners.delete(handle);
    this.playerColliderHandles.delete(client.sessionId);
    this.playerLastShot.delete(client.sessionId);
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
