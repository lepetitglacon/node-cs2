import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets'
import { Server, Socket } from 'socket.io'
import { Logger } from '@nestjs/common'

interface GamePlayer {
  socketId: string
  gameId: string
  playerId: string
}

@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGIN || ['http://localhost:5173', 'http://localhost:3000'],
    credentials: true,
  },
})
export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server

  private logger = new Logger('GameGateway')
  private gamePlayers = new Map<string, GamePlayer[]>()

  handleConnection(@ConnectedSocket() client: Socket) {
    this.logger.log(`Client connected: ${client.id}`)
  }

  handleDisconnect(@ConnectedSocket() client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`)

    // Remove player from all games
    for (const [gameId, players] of this.gamePlayers.entries()) {
      const index = players.findIndex((p) => p.socketId === client.id)
      if (index !== -1) {
        const player = players[index]
        players.splice(index, 1)
        this.server.to(gameId).emit('playerLeft', {
          playerId: player.playerId,
          gameId: gameId,
          playersCount: players.length,
        })
      }
    }
  }

  @SubscribeMessage('joinGame')
  handleJoinGame(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { gameId: string; playerId: string },
  ) {
    const { gameId, playerId } = data

    if (!gameId || !playerId) {
      client.emit('error', 'gameId and playerId are required')
      return
    }

    // Join the room
    client.join(gameId)

    // Store player info
    if (!this.gamePlayers.has(gameId)) {
      this.gamePlayers.set(gameId, [])
    }
    this.gamePlayers.get(gameId).push({
      socketId: client.id,
      gameId,
      playerId,
    })

    const players = this.gamePlayers.get(gameId)

    this.logger.log(`Player ${playerId} joined game ${gameId}`)

    // Notify all players in the room
    this.server.to(gameId).emit('playerJoined', {
      playerId,
      gameId,
      playersCount: players.length,
      players: players.map((p) => p.playerId),
    })

    // Send confirmation to the client
    client.emit('joinedGame', {
      gameId,
      playerId,
      playersCount: players.length,
      players: players.map((p) => p.playerId),
    })
  }

  @SubscribeMessage('leaveGame')
  handleLeaveGame(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { gameId: string; playerId: string },
  ) {
    const { gameId, playerId } = data

    if (!gameId) {
      return
    }

    client.leave(gameId)

    const players = this.gamePlayers.get(gameId) || []
    const index = players.findIndex((p) => p.socketId === client.id)
    if (index !== -1) {
      players.splice(index, 1)
    }

    this.logger.log(`Player ${playerId} left game ${gameId}`)

    // Notify remaining players
    this.server.to(gameId).emit('playerLeft', {
      playerId,
      gameId,
      playersCount: players.length,
      players: players.map((p) => p.playerId),
    })
  }

  @SubscribeMessage('gameMessage')
  handleGameMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { gameId: string; message: string; playerId: string },
  ) {
    const { gameId, message, playerId } = data

    if (!gameId) {
      return
    }

    this.logger.log(`Message in game ${gameId} from ${playerId}: ${message}`)

    // Broadcast message to all players in the game
    this.server.to(gameId).emit('gameMessage', {
      gameId,
      playerId,
      message,
      timestamp: new Date(),
    })
  }

  getPlayersInGame(gameId: string): GamePlayer[] {
    return this.gamePlayers.get(gameId) || []
  }
}
