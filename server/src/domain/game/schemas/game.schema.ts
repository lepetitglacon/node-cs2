import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { HydratedDocument } from 'mongoose'

export type GameState = 'lobby' | 'ingame' | 'ended'

@Schema({ timestamps: true })
export class Game {
  @Prop({ default: 'lobby' })
  state: GameState = 'lobby'

  @Prop({ default: 0 })
  maxPlayers: number = 0

  @Prop({ type: [String], default: [] })
  players: string[] = []

  @Prop()
  createdAt?: Date

  @Prop()
  updatedAt?: Date
}

export const GameSchema = SchemaFactory.createForClass(Game)
export type GameDocument = HydratedDocument<Game>
