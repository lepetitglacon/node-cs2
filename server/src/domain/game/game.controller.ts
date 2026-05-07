import { Controller, Post, Param } from '@nestjs/common'
import { CrudController } from '@/core/crud/crud.controller'
import { GameService } from './game.service'
import { Game } from './schemas/game.schema'

@Controller('game')
export class GameController extends CrudController<Game> {
  constructor(private gameService: GameService) {
    super(gameService)
  }

  @Post(':id/join')
  async joinGame(@Param('id') id: string) {
    return this.gameService.join(id)
  }
}
