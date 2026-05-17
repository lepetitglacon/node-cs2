import type { GameMode, MyRoomState, Player, Team } from "../rooms/schema/MyRoomState.js";
import type { SpawnPoint, SpawnPoints } from "./mapLoader.js";

export interface MatchStrategy {
  readonly mode: GameMode;
  readonly maxClients: number;
  readonly teamSize: number;
  // null = pas d'auto-respawn (mode S&D où on attend la fin du round)
  readonly respawnDelayMs: number | null;
  readonly friendlyFire: boolean;
  readonly magazineSize: number;
  readonly maxTotalAmmo: number;
  readonly startingHealth: number;

  // Choisit l'équipe d'un nouvel arrivant (typiquement la plus petite).
  assignTeam(state: MyRoomState): Team;

  // Choisit un point de spawn pour une équipe donnée.
  pickSpawn(team: Team, spawns: SpawnPoints): SpawnPoint;

  // Décide si shooter peut endommager victim (gère friendly fire).
  canDamage(shooter: Player, victim: Player): boolean;

  // Hook appelé quand victim vient de mourir, killer peut être null (suicide hors-tir).
  onKill(killer: Player | null, victim: Player): void;
}

export class Matchmaking10v10Strategy implements MatchStrategy {
  readonly mode: GameMode = 'matchmaking_10v10';
  readonly maxClients = 20;
  readonly teamSize = 10;
  readonly respawnDelayMs = 5000;
  readonly friendlyFire = false;
  readonly magazineSize = 30;
  readonly maxTotalAmmo = 90;
  readonly startingHealth = 100;

  assignTeam(state: MyRoomState): Team {
    let t1 = 0, t2 = 0;
    state.players.forEach((p) => {
      if (p.team === 'team1') t1++;
      else if (p.team === 'team2') t2++;
    });
    return t1 <= t2 ? 'team1' : 'team2';
  }

  pickSpawn(team: Team, spawns: SpawnPoints): SpawnPoint {
    const pool = spawns[team];
    if (pool.length === 0) {
      // Fallback si la map ne définit pas de spawn pour cette équipe.
      const fx = team === 'team1' ? -5 : 5;
      return { x: fx, y: 2, z: 0 };
    }
    return pool[Math.floor(Math.random() * pool.length)];
  }

  canDamage(shooter: Player, victim: Player): boolean {
    if (shooter === victim) return true;
    if (!this.friendlyFire && shooter.team === victim.team) return false;
    return true;
  }

  onKill(killer: Player | null, victim: Player): void {
    if (killer && killer !== victim) killer.kills += 1;
    victim.deaths += 1;
  }
}

export function createStrategy(mode: GameMode): MatchStrategy {
  switch (mode) {
    case 'matchmaking_10v10':
      return new Matchmaking10v10Strategy();
    case 'sd_5v5':
      // TODO: à implémenter
      throw new Error(`Mode ${mode} pas encore implémenté`);
  }
}
