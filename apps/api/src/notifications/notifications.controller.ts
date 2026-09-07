import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  IsArray,
  IsEmail,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { JwtPayload } from '../auth/auth.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RequireMfa, RequireMfaGuard } from '../mfa/require-mfa.guard.js';
import { Permissions, RolesGuard } from '../rbac/roles.guard.js';
import {
  NotificationTemplateError,
  type NotificationTemplate,
  type TemplateVariables,
  type TemplateBody,
} from './notification-templates.js';
import { NotificationsService } from './notifications.service.js';

class TemplatesDto {
  @IsArray() templates!: NotificationTemplate[];
}
class RecipientGroupsDto {
  @IsArray() @IsEmail({}, { each: true }) dealer!: string[];
  @IsArray() @IsEmail({}, { each: true }) support!: string[];
  @IsArray() @IsEmail({}, { each: true }) orders!: string[];
}
class PreviewDto {
  @IsString() @MaxLength(100) kind!: string;
  @IsEmail() to!: string;
  @IsString() @MaxLength(200) subject!: string;
  @IsString() @MaxLength(20000) text!: string;
  @IsOptional() @IsString() @MaxLength(20) locale?: string;
  @IsOptional() @IsObject() variables?: TemplateVariables;
  @IsOptional() @IsObject() template?: TemplateBody;
}

@Controller('admin/notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
@Permissions('system:settings:write')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}
  @Get('templates') templates() {
    return this.notifications.templates();
  }
  @Put('templates')
  @UseGuards(RequireMfaGuard)
  @RequireMfa()
  saveTemplates(@Body() dto: TemplatesDto, @CurrentUser() actor: JwtPayload) {
    return this.notifications.saveTemplates(dto.templates, actor);
  }
  @Post('preview') async preview(@Body() dto: PreviewDto) {
    if (
      JSON.stringify(dto.variables ?? {}).length > 30000 ||
      Object.values(dto.variables ?? {}).some(
        (value) => !['string', 'number', 'boolean'].includes(typeof value),
      )
    )
      throw new BadRequestException('Invalid preview variables');
    if (
      dto.template &&
      (typeof dto.template.subject !== 'string' ||
        dto.template.subject.length > 200 ||
        typeof dto.template.text !== 'string' ||
        dto.template.text.length > 20000 ||
        (dto.template.html !== undefined &&
          (typeof dto.template.html !== 'string' ||
            dto.template.html.length > 40000)))
    )
      throw new BadRequestException('Invalid preview template');
    try {
      return await this.notifications.preview(
        { ...dto, dedupeKey: 'preview', internalGroup: false },
        dto.template,
      );
    } catch (error) {
      if (error instanceof NotificationTemplateError)
        throw new BadRequestException(error.code);
      throw error;
    }
  }
  @Get('groups') groups() {
    return this.notifications.recipientGroups();
  }
  @Put('groups')
  @UseGuards(RequireMfaGuard)
  @RequireMfa()
  saveGroups(
    @Body() dto: RecipientGroupsDto,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.notifications.saveGroups(dto, actor);
  }
}
