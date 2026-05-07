import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { AppController } from './app.controller'
import { AppService } from './app.service'
import { DbModule } from './core/db/db.module'
import { GameModule } from './domain/game/game.module'
import { UserModule } from './domain/user/user.module'
import { AuthModule } from './auth/auth.module'
import { GameGateway } from './core/websocket/game.gateway'

@Module({
  imports: [
    ConfigModule.forRoot(),
    DbModule,
    GameModule,
    UserModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [AppService, GameGateway],
})
export class AppModule {}
