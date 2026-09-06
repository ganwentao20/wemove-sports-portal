import { ContactStatus } from '@prisma/client';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateContactDto {
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
