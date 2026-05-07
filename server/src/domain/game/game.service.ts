import { BadRequestException, Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { CrudService } from '@/core/crud/crud.service'
import { Game } from './schemas/game.schema'

@Injectable()
export class GameService extends CrudService<Game> {
  constructor(@InjectModel(Game.name) private gameModel: Model<Game>) {
    super(gameModel)
  }

  async join(id: string) {
    const game = await this.findOne(id)
    if (!game) {
      throw new BadRequestException('Game not found')
    }
    if (game.state !== 'lobby') {
      throw new BadRequestException('Game is not in lobby state')
    }
    if (game.players.length >= game.maxPlayers) {
      throw new BadRequestException('Game is full')
    }

    return this.toGameState(game)
  }

  toGameState(game: Game) {
    return game
  }
}
