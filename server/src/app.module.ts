import { Module } from '@nestjs/common'
import { AppController } from './app.controller'
import { AppService } from './app.service'
import { DbModule } from './core/db/db.module'
import { GameModule } from './domain/game/game.module'
import { GameGateway } from './core/websocket/game.gateway'

@Module({
  imports: [DbModule, GameModule],
  controllers: [AppController],
  providers: [AppService, GameGateway],
})
export class AppModule {}
