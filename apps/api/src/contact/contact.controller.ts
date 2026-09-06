import {
  Body,
  Controller,
  Delete,
  Get,
  Ip,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { JwtPayload } from '../auth/auth.service.js';
import { ContactService } from './contact.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RequireMfa, RequireMfaGuard } from '../mfa/require-mfa.guard.js';
import { Roles, RolesGuard } from '../rbac/roles.guard.js';
import { CreateContactDto, UpdateContactStatusDto } from './dto/contact.dto.js';

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
  create(@Body() dto: CreateContactDto, @Ip() ip?: string) {
    return this.contact.create(dto, ip);
  }

  @Put(':id/status')
  @UseGuards(JwtAuthGuard, RolesGuard, RequireMfaGuard)
  @Roles('SUPER_ADMIN')
  @RequireMfa()
  setStatus(
    @Param('id') id: string,
    @Body() dto: UpdateContactStatusDto,
    @CurrentUser() actor: JwtPayload,
    @Ip() ip?: string,
  ) {
    return this.contact.setStatus(id, dto.status, actor, ip);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard, RequireMfaGuard)
  @Roles('SUPER_ADMIN')
  @RequireMfa()
  remove(
    @Param('id') id: string,
    @CurrentUser() actor: JwtPayload,
    @Ip() ip?: string,
  ) {
    return this.contact.remove(id, actor, ip);
  }
}
