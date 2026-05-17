# node-cs2

Jeu de tir multijoueur FPS inspiré de CS2, en temps réel. Monorepo avec un client React/BabylonJS et un serveur Colyseus/Rapier3D.

---

## Architecture générale

```
node-cs2/
├── client/   # Frontend React + BabylonJS (Vite)
├── server/   # Serveur de jeu Colyseus + physique Rapier3D
└── assets/   # Sources Blender + animations Mixamo (non servis directement)
```

Le serveur expose ses assets GLB sur `http://localhost:2567/assets/`. Le client les charge à la volée via `SceneLoader`.

---

## Serveur (`server/`)

**Stack** : Colyseus 0.17, Express, Rapier3D, TypeScript (tsx watch)

### Rooms

- `LobbyRoom` — room d'attente (liste des parties)
- `MyRoom` — room de jeu, max 4 joueurs, boucle à **60 Hz**

### Physique (Rapier3D)

Serveur autoritaire. Toute la physique tourne côté serveur :
- Sol : cuboid fixe 10×10
- Joueurs : capsule dynamique (half_height=0.6, radius=0.25), rotations verrouillées
- Détection des tirs : raycast depuis la position de la tête (`headY = posY + EYE_HEIGHT - BODY_Y_OFFSET`)
- `colliderOwners` : Map collider handle → sessionId pour identifier les victimes

### État partagé (`@colyseus/schema`)

```typescript
Player {
  state: 'alive' | 'dead'
  moveState: 'idle' | 'walk_front' | 'walk_back' | 'walk_left' | 'walk_right' | 'dying'
  x, y, z          // position
  qx, qy, qz, qw   // quaternion orientation complète (pitch + yaw)
  headY             // position des yeux (pour le raycast et les autres joueurs)
  health            // 0–100
  bullets           // munitions dans le chargeur (max 30)
  totalAmmo         // réserve (max 90)
  isReloading
}
```

### Messages réseau

| Direction       | Message        | Payload                                           |
|-----------------|----------------|---------------------------------------------------|
| client → server | `playerInput`  | `{forward, back, left, right, yaw, pitch, shoot}` |
| client → server | `reload`       | —                                                 |
| client → server | `respawn`      | —                                                 |
| server → client | `recoil`       | `{pitch: number, yaw: number}`                    |

### Arme : AK-47

- Cooldown tir : 100 ms
- Dégâts : 10 HP par balle
- Rechargement : 2500 ms
- Réinitialisation du burst : 450 ms sans tir
- Pattern de recul : tableau de 30 offsets cumulatifs `{pitch, yaw}` (défini dans `MyRoom.ts`)
- Le serveur envoie l'offset du pattern au client via le message `recoil` ; le client l'applique visuellement sur la caméra

---

## Client (`client/`)

**Stack** : React 19, BabylonJS 9 via `react-babylonjs`, Colyseus SDK, Tailwind 4, Chakra UI 3, Vite 8

### Arborescence `src/`

```
views/game/
  Game.tsx          — scène BabylonJS + montage des composants
  GameContext.tsx   — contexte React : room, currentPlayer, otherPlayers
  PlayerCamera.tsx  — caméra FPS + prédiction client + envoi inputs
  OtherPlayer.tsx   — rendu des autres joueurs (GLB + animations + barre HP)
  WeaponManager.tsx — arme à la première personne (sway + recul)
  roomContext.ts    — accès bas niveau room/state Colyseus
views/list/
  GamesList.tsx     — liste des parties disponibles
components/
  GameOverlay.tsx   — HUD (crosshair, vie…)
  DeathScreen.tsx   — écran de mort + bouton respawn
  LoadingScreen.tsx — écran de chargement
game/movement.ts    — logique de mouvement partagée client/serveur
hooks/
  usePlayerInput.ts — capture clavier (ZQSD / WASD)
  useTickLoop.ts    — boucle à intervalle fixe (64 Hz)
  useDebugMode.ts   — toggle mode debug (K)
```

### Prédiction client

`PlayerCamera` applique `applyMovement` localement à **64 Hz** (même fonction que le serveur) puis envoie `playerInput`. La réconciliation se fait par lerp :
- Joueur local : `RECONCILE_LERP = 0.05` (lissage doux vers la position serveur)
- Autres joueurs : `LERP = 0.2` (interpolation position + slerp quaternion)

### Mouvement (partagé `game/movement.ts`)

```
ACCELERATION = 0.012
FRICTION     = 0.72
MAX_SPEED    = 0.14
```

Le vecteur vitesse est accumulé chaque tick, plafonné à MAX_SPEED, puis multiplié par FRICTION. Le serveur multiplie ensuite par 64 pour obtenir la vitesse Rapier (`linvel = vel * 64`).

### OtherPlayer

- Charge `soldier.glb` et `weapon/ak-47.glb` depuis le serveur
- Animations Mixamo embarquées dans le GLB : `idle`, `walk_front`, `walk_back`, `walk_left`, `walk_right`, `dying`
- L'arme est attachée à un `TransformNode` pivot qui suit la rotation complète du quaternion (pitch + yaw)
- Barre de HP via `AdvancedDynamicTexture` BabylonJS GUI, liée au mesh du personnage
- Mode debug : capsule wireframe orange + ligne de visée rouge

### WeaponManager (arme FPS)

- Mesh AK-47 parenté à la caméra, rendu dans le groupe 2 (depth buffer vidé → toujours devant)
- **Sway** : décalage de position/rotation proportionnel au delta souris, lissé par lerp
- **Recul** : reçoit l'offset `{pitch, yaw}` via le message `recoil`, l'applique progressivement sur `camera.rotation`, puis revient à 0 après `RECOIL_RECOVERY_DELAY = 250 ms`

---

## Lancer le projet

```bash
# Serveur
cd server && npm run start

# Client
cd client && npm run dev
```

Le serveur écoute sur le port **2567**. Le client sur le port Vite par défaut (5173).

---

## Conventions

- Pas de fichier `index.ts` / `index.tsx`
- TypeScript strict des deux côtés
- ESLint + Prettier côté client
- Tests Mocha côté serveur (`npm test`)
