import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Ip,
  Param,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { extname } from 'node:path';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard, OptionalJwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { JwtPayload } from '../auth/auth.service.js';
import { DealerService } from './dealer.service.js';
import { CreateDealerApplicationDto } from './dto/dealer-application.dto.js';
import { DealerCatalogQueryDto } from './dto/dealer-catalog-query.dto.js';
import { QuickOrderDto } from './dto/quick-order.dto.js';
import {
  MediaService,
  type UploadedMediaFile,
} from '../media/media.service.js';

const APPLICATION_UPLOADS: Record<string, string[]> = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'application/pdf': ['.pdf'],
};

/**
 * MB：经销商申请入口。
 * - POST 提交公开（携带登录态自动绑定 applicantId，归属校验强依据）
 * - GET 详情仅登录后的本人（applicantId）或已关联企业成员（companyId）可见
 */
@Controller('dealer')
export class DealerController {
  constructor(
    private readonly dealer: DealerService,
    private readonly media: MediaService,
  ) {}

  @Post('application-attachments')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { files: 1, fileSize: 5 * 1024 * 1024 },
      fileFilter: (_request, file, callback) => {
        const allowedExtensions = APPLICATION_UPLOADS[file.mimetype];
        const extension = extname(file.originalname).toLowerCase();
        const allowed = Boolean(allowedExtensions?.includes(extension));
        callback(
          allowed
            ? null
            : new BadRequestException(
                'only JPG, PNG, and PDF qualification files are allowed',
              ),
          allowed,
        );
      },
    }),
  )
  async uploadApplicationAttachment(
    @UploadedFile() file: UploadedMediaFile,
    @Ip() ip?: string,
  ) {
    if (!file) throw new BadRequestException('file is required');
    await this.dealer.assertAttachmentUploadAllowed(ip);
    return this.media.createDealerAttachment(file);
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Post('applications')
  createApplication(
    @Body() dto: CreateDealerApplicationDto,
    @Ip() ip?: string,
    @CurrentUser() user?: JwtPayload,
  ) {
    return this.dealer.createApplication(dto, ip, user);
  }

  @UseGuards(JwtAuthGuard)
  @Get('applications/:id')
  findApplication(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.dealer.findApplication(id, user);
  }

  /** F-B04：仅已审批企业成员可见的目录与成交价。 */
  @UseGuards(JwtAuthGuard)
  @Get('catalog')
  catalog(
    @Query() query: DealerCatalogQueryDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.dealer.listDealerCatalog(query.quantity, user);
  }

  /** DLR-04：批量 SKU/数量逐行校验和企业价格预览，不创建业务单据。 */
  @UseGuards(JwtAuthGuard)
  @Post('quick-order/validate')
  validateQuickOrder(
    @Body() dto: QuickOrderDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.dealer.validateQuickOrder(dto.lines, user);
  }
}
