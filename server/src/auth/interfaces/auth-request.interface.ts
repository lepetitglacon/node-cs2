import type { Request } from 'express'
import type { UserDocument } from '@/domain/user/schemas/user.schema'

export interface AuthRequest extends Request {
  user: UserDocument
}
