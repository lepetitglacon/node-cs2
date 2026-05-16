import {MapSchema, Schema, type } from "@colyseus/schema";

export type PlayerState = 'alive' | 'dead'

export class Player extends Schema {
  @type("string") state: PlayerState = 'alive';
  @type("number") x: number = 0;
  @type("number") y: number = 0;
  @type("number") z: number = 0;
  @type("number") qx: number = 0;
  @type("number") qy: number = 0;
  @type("number") qz: number = 0;
  @type("number") qw: number = 1;
  @type("number") headY: number = 0;
  @type("number") health: number = 100;
}

export class MyRoomState extends Schema {
  @type({ map: Player }) players = new MapSchema<Player>()
  @type("string") mySynchronizedProperty: string = "Hello world";

}
