import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ContactService } from './contact.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { Roles, RolesGuard } from '../rbac/roles.guard.js';

@Controller('contacts')
export class ContactController {
  constructor(private readonly contact: ContactService) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  list() {
    return this.contact.list();
  }

  @Post()
  create(@Body() dto: Record<string, string>) {
    return this.contact.create(dto);
  }

  @Put(':id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  setStatus(@Param('id') id: string, @Body() dto: { status?: string }) {
    if (!dto.status) {
      throw new Error('status is required');
    }
    return this.contact.setStatus(id, dto.status as 'NEW' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED');
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  remove(@Param('id') id: string) {
    return this.contact.remove(id);
  }
}
