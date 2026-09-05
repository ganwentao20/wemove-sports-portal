import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import type { Paged } from './api-response.js';

/** 分页查询基类：查询 DTO 继承它，自动获得 page/pageSize 校验 */
export class PageQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 20;
}

/** 供 Service 层返回分页数据的工具 */
export function toPaged<T>(items: T[], total: number, query: { page: number; pageSize: number }): Paged<T> {
  return { items, total, page: query.page, pageSize: query.pageSize };
}
