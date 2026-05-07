import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    cors: {
      origin: process.env.CORS_ORIGIN || ['http://localhost:5173', 'http://localhost:3000'],
      credentials: true,
    },
  })
  await app.listen(process.env.PORT ?? 3000)
}
bootstrap()
