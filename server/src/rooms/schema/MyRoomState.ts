import {MapSchema, Schema, type } from "@colyseus/schema";

export type PlayerState = 'alive' | 'dead'
export type Team = 'team1' | 'team2'
export type GameMode = 'matchmaking_10v10' | 'sd_5v5'
export type MoveState =
  | 'idle'
  | 'walk_front' | 'walk_back' | 'walk_left' | 'walk_right'
  | 'sprint_front' | 'sprint_back' | 'sprint_left' | 'sprint_right'
  | 'crouch_idle' | 'crouch_front' | 'crouch_back' | 'crouch_left' | 'crouch_right'
  | 'jump'
  | 'dying'

export class Player extends Schema {
  @type("string") state: PlayerState = 'alive';
  @type("string") moveState: MoveState = 'idle';
  @type("string") team: Team = 'team1';
  @type("number") x: number = 0;
  @type("number") y: number = 0;
  @type("number") z: number = 0;
  @type("number") qx: number = 0;
  @type("number") qy: number = 0;
  @type("number") qz: number = 0;
  @type("number") qw: number = 1;
  @type("number") headY: number = 0;
  @type("number") health: number = 100;
  @type("number") bullets: number = 30;
  @type("number") totalAmmo: number = 90;
  @type("boolean") isReloading: boolean = false;
  @type("number") kills: number = 0;
  @type("number") deaths: number = 0;
  // Timestamp (ms) auquel l'auto-respawn aura lieu. 0 = pas en attente.
  @type("number") respawnAt: number = 0;
}

export class MyRoomState extends Schema {
  @type({ map: Player }) players = new MapSchema<Player>()
  @type("string") mapId: string = "test2";
  @type("string") mode: GameMode = 'matchmaking_10v10';
}
