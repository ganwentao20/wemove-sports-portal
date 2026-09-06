import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Ip,
  Param,
  Post,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { extname } from 'node:path';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { JwtPayload } from '../auth/auth.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RequireMfa, RequireMfaGuard } from '../mfa/require-mfa.guard.js';
import { Roles, RolesGuard } from '../rbac/roles.guard.js';
import { MediaService } from './media.service.js';
import type { UploadedMediaFile } from './media.service.js';

const ALLOWED_UPLOADS: Record<string, string[]> = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
  'application/pdf': ['.pdf'],
};

@Controller('media')
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  list() {
    return this.media.list();
  }

  @Post('upload')
  @UseGuards(JwtAuthGuard, RolesGuard, RequireMfaGuard)
  @Roles('SUPER_ADMIN')
  @RequireMfa()
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { files: 1, fileSize: 5 * 1024 * 1024 },
      fileFilter: (_request, file, callback) => {
        const allowedExtensions = ALLOWED_UPLOADS[file.mimetype];
        const extension = extname(file.originalname).toLowerCase();
        callback(
          allowedExtensions?.includes(extension)
            ? null
            : new BadRequestException(
                'only JPG, PNG, WebP, and PDF files are allowed',
              ),
          Boolean(allowedExtensions?.includes(extension)),
        );
      },
    }),
  )
  upload(
    @UploadedFile() file: UploadedMediaFile,
    @Body('visibility') visibility: string | undefined,
    @CurrentUser() actor: JwtPayload,
    @Ip() ip?: string,
  ) {
    if (!file) {
      throw new BadRequestException('file is required');
    }
    return this.media.create(file, visibility, actor, ip);
  }

  @Get(':id/sign')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  sign(@Param('id') id: string, @Query('expire') expire?: string) {
    return this.media.sign(id, Number(expire ?? 60));
  }

  @Get(':id/download')
  async download(
    @Param('id') id: string,
    @Query('expires') expires: string | undefined,
    @Query('signature') signature: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    const result = await this.media.open(id, expires, signature);
    response.set({
      'Content-Type': result.mimeType,
      'Content-Disposition': `inline; filename="${result.fileName.replace(/["\\\r\n]/g, '')}"`,
    });
    return new StreamableFile(result.stream);
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
    return this.media.delete(id, actor, ip);
  }
}
