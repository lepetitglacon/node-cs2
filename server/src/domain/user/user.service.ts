import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import * as bcrypt from 'bcryptjs'
import { User, UserDocument } from './schemas/user.schema'

@Injectable()
export class UserService {
  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {}

  async create(username: string, email: string, password: string): Promise<User> {
    const hashedPassword = await bcrypt.hash(password, 10)
    const user = new this.userModel({
      username,
      email,
      password: hashedPassword,
    })
    return user.save()
  }

  async findByUsername(username: string): Promise<User | null> {
    return this.userModel.findOne({ username }).exec()
  }

  async findById(id: string): Promise<User | null> {
    return this.userModel.findById(id).exec()
  }

  async validatePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash)
  }
}
