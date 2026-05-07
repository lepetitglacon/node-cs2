import { Get, Post, Body, Patch, Param, Delete } from '@nestjs/common'
import { CrudService } from './crud.service'

export class CrudController<T> {
  constructor(private crudService: CrudService<T>) {}

  @Post()
  async create(@Body() createDto: Partial<T>): Promise<T> {
    return this.crudService.create(createDto)
  }

  @Get()
  async findAll(): Promise<T[]> {
    return this.crudService.findAll()
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<T | null> {
    return this.crudService.findOne(id)
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateDto: Partial<T>,
  ): Promise<T | null> {
    return this.crudService.update(id, updateDto)
  }

  @Delete(':id')
  async remove(@Param('id') id: string): Promise<T | null> {
    return this.crudService.remove(id)
  }
}
