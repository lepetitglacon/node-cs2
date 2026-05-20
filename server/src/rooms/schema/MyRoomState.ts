import {MapSchema, ArraySchema, Schema, type } from "@colyseus/schema";

export type PlayerState = 'alive' | 'dead'
export type Team = 'team1' | 'team2'
export type GameMode = 'matchmaking_10v10' | 'sd_5v5'
export type QuestStep = 'fetch_weapon' | 'go_to_stand' | 'shoot_targets' | 'done'
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
  // Armes possédées (vide au spawn, l'AK s'ajoute via la quête).
  @type(["string"]) weapons = new ArraySchema<string>();
  @type("string") questStep: QuestStep = 'fetch_weapon';
  @type("number") score: number = 0;
  // true quand le joueur touche le sol (empêche le saut infini).
  @type("boolean") grounded: boolean = false;
}

// Cible d'entraînement : cube côté serveur, modèle soldat côté client.
export class Target extends Schema {
  @type("number") x: number = 0;
  @type("number") y: number = 0;
  @type("number") z: number = 0;
  // false = touchée, le client joue l'animation de mort.
  @type("boolean") active: boolean = true;
}

export class MyRoomState extends Schema {
  @type({ map: Player }) players = new MapSchema<Player>()
  @type({ map: Target }) targets = new MapSchema<Target>()
  @type("string") mapId: string = "test2";
  @type("string") mode: GameMode = 'matchmaking_10v10';
}
