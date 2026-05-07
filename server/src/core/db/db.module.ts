import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { MongooseModule } from '@nestjs/mongoose'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        const user = configService.get<string>('DB_USER')!
        const password = configService.get<string>('DB_PASSWORD')!
        const host = configService.get<string>('DB_HOST', 'localhost')
        const port = configService.get<number>('DB_PORT', 27017)
        const dbName = configService.get<string>('DB_NAME')!
        const authSource = configService.get<string>('DB_AUTHSOURCE', 'admin')

        const uri = `mongodb://${host}:${port}/${dbName}`
        console.log(uri)
        return {
          uri,
          retryAttempts: 3,
          retryDelay: 5000,
        }
      },
    }),
  ],
})
export class DbModule {}
