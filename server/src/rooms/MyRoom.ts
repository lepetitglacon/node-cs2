import { Room, Client, CloseCode } from "colyseus";
import {MyRoomState, Player} from "./schema/MyRoomState.js";

export class MyRoom extends Room {
  maxClients = 4;
  state = new MyRoomState();

  messages = {
    playerMove: (client: Client, message: any) => {
      console.log('Received playerMove from', client.sessionId, message);
      const player = this.state.players.get(client.sessionId);
      console.log('Player found:', !!player);
      if (player) {
        console.log(`Player ${client.sessionId} moved to:`, message.x, message.y, message.z);
        player.x = message.x;
        player.y = message.y;
        player.z = message.z;
        player.yaw = message.yaw;
        player.pitch = message.pitch;
      }
    }
  }

  onCreate (options: any) {
    /**
     * Called when a new room is created.
     */
  }

  onAuth(client: Client, options, context) {
    return true
  }

  onJoin (client: Client, options: any) {
    /**
     * Called when a client joins the room.
     */
    console.log(client.sessionId, "joined!");

    // create Player instance
    const player = new Player();

    // place Player at a random position
    const FLOOR_SIZE = 10;
    player.x = -(FLOOR_SIZE/2) + (Math.random() * FLOOR_SIZE);
    player.y = 1;
    player.z = -(FLOOR_SIZE/2) + (Math.random() * FLOOR_SIZE);

    // place player in the map of players by its sessionId
    // (client.sessionId is unique per connection!)
    this.state.players.set(client.sessionId, player);
  }

  onLeave (client: Client, code: CloseCode) {
    /**
     * Called when a client leaves the room.
     */
    this.state.players.delete(client.sessionId);
    console.log(client.sessionId, "left!", code);
  }

  onDispose() {
    /**
     * Called when the room is disposed.
     */
    console.log("room", this.roomId, "disposing...");
  }

  update() {

  }

}
