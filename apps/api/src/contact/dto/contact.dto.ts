import { ContactStatus } from '@prisma/client';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsIn,
  IsArray,
  IsBoolean,
  MaxLength,
  Matches,
  MinLength,
  ArrayMaxSize,
  ValidateNested,
  Equals,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PageQueryDto } from '../../common/pagination.dto.js';

export class ContactAttachmentDto {
  @IsString() @MaxLength(100) mediaId!: string;
  @IsString() @MaxLength(200) attachmentToken!: string;
}

export class CreateContactDto {
  @IsOptional()
  @IsString()
  @Matches(/^[a-zA-Z0-9-]{16,80}$/)
  submissionKey?: string;
  @IsBoolean() @Equals(true) consent!: boolean;
  @IsString() @MinLength(1) @MaxLength(40) consentVersion!: string;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => ContactAttachmentDto)
  attachments?: ContactAttachmentDto[];
  @IsOptional()
  @IsIn([
    'CONTACT',
    'PRODUCT_INQUIRY',
    'ORDER_SUPPORT',
    'DEALER_SUPPORT',
    'PRIVACY',
  ])
  source?: string;
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;

  @IsEmail()
  @MaxLength(160)
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  country?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(160)
  subject!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(4000)
  content!: string;

  /** Honeypot: browsers leave this hidden field empty. */
  @IsOptional()
  @IsString()
  @MaxLength(0)
  website?: string;
}

export class UpdateContactStatusDto {
  @IsEnum(ContactStatus)
  status!: ContactStatus;
}

export class ContactQueryDto extends PageQueryDto {
  @IsOptional() @IsEnum(ContactStatus) status?: ContactStatus;
  @IsOptional() @IsIn(['LOW', 'NORMAL', 'HIGH', 'URGENT']) priority?: string;
  @IsOptional()
  @IsIn([
    'CONTACT',
    'PRODUCT_INQUIRY',
    'ORDER_SUPPORT',
    'DEALER_SUPPORT',
    'PRIVACY',
  ])
  source?: string;
  @IsOptional() @IsString() @MaxLength(160) search?: string;
  @IsOptional() @IsString() @MaxLength(100) assignedTo?: string;
  @IsOptional() @IsString() @MaxLength(100) assignedTeam?: string;
}

export class UpdateContactDto {
  @IsOptional() @IsString() @MaxLength(100) assignedTeam?: string;
  @IsOptional() @IsString() @MaxLength(100) assignedTo?: string;
  @IsOptional() @IsIn(['LOW', 'NORMAL', 'HIGH', 'URGENT']) priority?: string;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  tags?: string[];
  @IsOptional() @IsEnum(ContactStatus) status?: ContactStatus;
}
export class ContactReplyDto {
  @IsString() @MinLength(2) @MaxLength(4000) text!: string;
  @IsBoolean() internal!: boolean;
}
