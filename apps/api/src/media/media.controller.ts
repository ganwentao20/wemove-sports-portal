import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
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
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { Roles, RolesGuard } from '../rbac/roles.guard.js';
import { MediaService } from './media.service.js';

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
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @UseInterceptors(FileInterceptor('file'))
  upload(@UploadedFile() file: any, @Body('visibility') visibility?: string) {
    if (!file) {
      throw new BadRequestException('file is required');
    }
    return this.media.create(file, visibility);
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
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  remove(@Param('id') id: string) {
    return this.media.delete(id);
  }
}
