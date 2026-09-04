import { IsOptional, IsString, MaxLength } from 'class-validator';
import { PageQueryDto } from '../../common/pagination.dto.js';

/** 公开商品列表查询（游客可用的字段白名单已由 Service 层控制） */
export class CatalogQueryDto extends PageQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  search?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  categorySlug?: string;
}
