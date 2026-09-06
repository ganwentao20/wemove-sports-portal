import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

/** 核心版仅按采购数量取价，避免在 7 天课程周期引入复杂筛选。 */
export class DealerCatalogQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10000)
  quantity = 1;
}
