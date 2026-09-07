import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  Matches,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
export class MediaResourceQueryDto {
  @IsOptional() @IsString() @MaxLength(100) productId?: string;
}
export class MediaMetadataDto {
  @IsOptional() @IsString() @MaxLength(160) title?: string;
  @IsOptional()
  @IsString()
  @Matches(/^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/)
  language?: string;
  @IsOptional()
  @IsIn(['CATALOG', 'MANUAL', 'IMAGE', 'VIDEO', 'CERTIFICATE', 'FORM', 'OTHER'])
  resourceType?: string;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  tags?: string[];
  @IsOptional() @IsBoolean() decorative?: boolean;
  @IsOptional() @IsDateString() publishedAt?: string;
  @IsString() @MaxLength(500) alt!: string;
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  usageLocations!: string[];
  @IsArray() @ArrayMaxSize(500) @IsString({ each: true }) companyIds!: string[];
  @IsArray() @ArrayMaxSize(500) @IsString({ each: true }) productIds!: string[];
  @IsOptional() @IsString() previousVersionId?: string;
}
