import { Controller, Post, Body, UseGuards, Req } from '@nestjs/common'
import type { Request } from 'express'
import { AuthService } from './auth.service'
import { LocalAuthGuard } from './guards/local-auth.guard'
import type { UserDocument } from '@/domain/user/schemas/user.schema'

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  async register(
    @Body() body: { username: string; email: string; password: string },
  ) {
    return this.authService.register(body.username, body.email, body.password)
  }

  @UseGuards(LocalAuthGuard)
  @Post('login')
  async login(@Req() req: Request) {
    const user = req.user as UserDocument
    return this.authService.login(user)
  }
}
