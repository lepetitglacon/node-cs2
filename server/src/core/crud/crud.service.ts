import { Injectable } from '@nestjs/common'
import { Model } from 'mongoose'

@Injectable()
export class CrudService<T> {
  constructor(private model: Model<T>) {}

  async create(createDto: Partial<T>): Promise<T> {
    const created = new this.model(createDto)
    return created.save() as Promise<T>
  }

  async findAll(): Promise<T[]> {
    return this.model.find().exec()
  }

  async findOne(id: string): Promise<T | null> {
    return this.model.findById(id).exec()
  }

  async update(id: string, updateDto: Partial<T>): Promise<T | null> {
    return this.model.findByIdAndUpdate(id, updateDto, { new: true }).exec()
  }

  async remove(id: string): Promise<T | null> {
    return this.model.findByIdAndDelete(id).exec()
  }
}
