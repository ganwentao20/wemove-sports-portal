import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminService } from './admin.service.js';
import { Roles } from '../rbac/roles.guard.js';
import { RolesGuard } from '../rbac/roles.guard.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { JwtPayload } from '../auth/auth.service.js';
import {
  CreateStaffDto,
  SetStaffPasswordDto,
  StaffQueryDto,
  UpdateStaffDto,
} from './dto/admin.dto.js';

/** 员工管理（仅 SUPER_ADMIN；角色权限见 Seed/后台） */
@Controller('admin/staff')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class StaffController {
  constructor(private readonly admin: AdminService) {}

  @Get()
  list(@Query() query: StaffQueryDto) {
    return this.admin.listStaff(query);
  }

  @Post()
  create(@Body() dto: CreateStaffDto, @CurrentUser() actor: JwtPayload) {
    return this.admin.createStaff(dto, actor);
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.admin.getStaff(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateStaffDto,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.admin.updateStaff(id, dto, actor);
  }

  @Patch(':id/password')
  resetPassword(
    @Param('id') id: string,
    @Body() dto: SetStaffPasswordDto,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.admin.resetStaffPassword(id, dto, actor);
  }
}
