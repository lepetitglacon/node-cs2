import { Room, Client, CloseCode } from "colyseus";
import { MyRoomState, Player } from "./schema/MyRoomState.js";
import { applyMovement } from "../game/movement.js";

export class MyRoom extends Room {
  maxClients = 4;
  state = new MyRoomState();

  messages = {
    playerInput: (client: Client, message: any) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;

      const { forward, back, left, right, yaw, pitch } = message;

      const vel = { x: player.vx, z: player.vz };
      applyMovement(vel, { forward, back, left, right }, yaw);
      player.vx = vel.x;
      player.vz = vel.z;

      player.x += player.vx;
      player.z += player.vz;

      const cy = Math.cos(yaw / 2), sy = Math.sin(yaw / 2);
      const cp = Math.cos(pitch / 2), sp = Math.sin(pitch / 2);
      player.qx = cy * sp;
      player.qy = sy * cp;
      player.qz = -sy * sp;
      player.qw = cy * cp;
    }
  }

  onCreate(options: any) {}

  onAuth(client: Client, options: any, context: any) {
    return true;
  }

  onJoin(client: Client, options: any) {
    console.log(client.sessionId, "joined!");

    const player = new Player();
    const FLOOR_SIZE = 10;
    player.x = -(FLOOR_SIZE / 2) + Math.random() * FLOOR_SIZE;
    player.y = 0;
    player.z = -(FLOOR_SIZE / 2) + Math.random() * FLOOR_SIZE;

    this.state.players.set(client.sessionId, player);
  }

  onLeave(client: Client, code: CloseCode) {
    this.state.players.delete(client.sessionId);
    console.log(client.sessionId, "left!", code);
  }

  onDispose() {
    console.log("room", this.roomId, "disposing...");
  }
}
