import { Injectable, ConflictException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { UserService } from '@/domain/user/user.service'
import { UserDocument } from '@/domain/user/schemas/user.schema'

@Injectable()
export class AuthService {
  constructor(
    private userService: UserService,
    private jwtService: JwtService,
  ) {}

  async validateUser(username: string, password: string): Promise<any> {
    const user = await this.userService.findByUsername(username)
    if (user && (await this.userService.validatePassword(password, user.password))) {
      return user
    }
    return null
  }

  async register(username: string, email: string, password: string) {
    const existingUser = await this.userService.findByUsername(username)
    if (existingUser) {
      throw new ConflictException('Username already exists')
    }

    const user = (await this.userService.create(username, email, password)) as UserDocument
    const token = this.jwtService.sign({ sub: user._id.toString() })

    return {
      access_token: token,
      user: {
        id: user._id.toString(),
        username: user.username,
        email: user.email,
      },
    }
  }

  async login(user: UserDocument) {
    const token = this.jwtService.sign({ sub: user._id.toString() })

    return {
      access_token: token,
      user: {
        id: user._id.toString(),
        username: user.username,
        email: user.email,
      },
    }
  }
}
