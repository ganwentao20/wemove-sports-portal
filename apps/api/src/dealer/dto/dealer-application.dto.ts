import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

/** MB：申请附件仅接收已由媒体/上传服务生成的私有对象描述，不接收二进制正文。 */
export class DealerApplicationAttachmentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  mediaId: string;

  @IsString()
  @MinLength(32)
  @MaxLength(100)
  attachmentToken: string;

  @IsString()
  @MinLength(1)
  @MaxLength(160)
  fileName: string;

  @IsIn(['image/jpeg', 'image/png', 'application/pdf'])
  mimeType: string;

  @IsInt()
  @Min(1)
  @Max(5 * 1024 * 1024)
  sizeBytes: number;

  @IsOptional()
  @IsIn(['PRIVATE'])
  visibility?: 'PRIVATE';
}

/** MB：经销商分步申请最终提交字段；各步骤由前端暂存，服务端按完整 DTO 校验。 */
export class CreateDealerApplicationDto {
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  companyName: string;

  @IsString()
  @MinLength(2)
  @MaxLength(80)
  legalRegNo: string;

  @IsString()
  @MinLength(2)
  @MaxLength(80)
  contactName: string;

  @IsEmail()
  @MaxLength(160)
  contactEmail: string;

  @IsString()
  @MinLength(5)
  @MaxLength(32)
  phone: string;

  @IsString()
  @MinLength(2)
  @MaxLength(80)
  country: string;

  @IsString()
  @MinLength(2)
  @MaxLength(80)
  businessType: string;

  @IsArray()
  @ArrayMaxSize(8)
  @ValidateNested({ each: true })
  @Type(() => DealerApplicationAttachmentDto)
  attachments: DealerApplicationAttachmentDto[];
}
