import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { CrudService } from '@/core/crud/crud.service'
import { Game } from './schemas/game.schema'

@Injectable()
export class GameService extends CrudService<Game> {
  constructor(@InjectModel(Game.name) private gameModel: Model<Game>) {
    super(gameModel)
  }
}
