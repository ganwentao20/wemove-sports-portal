import {
  Body,
  Controller,
  Delete,
  Get,
  Ip,
  Param,
  Post,
  Query,
  Put,
  Patch,
  Res,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { UploadedMediaFile } from '../media/media.service.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { JwtPayload } from '../auth/auth.service.js';
import { ContactService } from './contact.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RequireMfa, RequireMfaGuard } from '../mfa/require-mfa.guard.js';
import { Roles, RolesGuard } from '../rbac/roles.guard.js';
import {
  ContactQueryDto,
  ContactReplyDto,
  CreateContactDto,
  UpdateContactDto,
  UpdateContactStatusDto,
} from './dto/contact.dto.js';
import type { Response } from 'express';
import { csv } from '../platform/platform.service.js';

@Controller('contacts')
export class ContactController {
  constructor(private readonly contact: ContactService) {}
  @Get('assignees')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  assignees() {
    return this.contact.assignees();
  }

  @Post('attachments')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { files: 1, fileSize: 5 * 1024 * 1024 },
    }),
  )
  attachment(@UploadedFile() file: UploadedMediaFile, @Ip() ip?: string) {
    return this.contact.attachment(file, ip);
  }
  @Get(':id/attachments/:mediaId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  attachmentAccess(@Param('id') id: string, @Param('mediaId') mediaId: string) {
    return this.contact.attachmentAccess(id, mediaId);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  list(@Query() query: ContactQueryDto) {
    return this.contact.list(query);
  }

  @Get('export')
  @UseGuards(JwtAuthGuard, RolesGuard, RequireMfaGuard)
  @Roles('SUPER_ADMIN')
  @RequireMfa()
  async export(
    @Query() query: ContactQueryDto,
    @CurrentUser() actor: JwtPayload,
    @Res() response: Response,
  ) {
    const leads = await this.contact.exportRows(query, actor);
    response.type('text/csv').attachment('contacts.csv').send(csv(leads));
  }
  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard, RequireMfaGuard)
  @Roles('SUPER_ADMIN')
  @RequireMfa()
  update(
    @Param('id') id: string,
    @Body() input: UpdateContactDto,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.contact.update(id, input, actor);
  }
  @Post(':id/replies')
  @UseGuards(JwtAuthGuard, RolesGuard, RequireMfaGuard)
  @Roles('SUPER_ADMIN')
  @RequireMfa()
  reply(
    @Param('id') id: string,
    @Body() input: ContactReplyDto,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.contact.reply(id, input, actor);
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
