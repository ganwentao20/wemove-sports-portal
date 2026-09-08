import { IsOptional, Matches } from 'class-validator';
export class DealerDirectoryQueryDto {
  @IsOptional()
  @Matches(/^[a-z]{2,3}(?:-[A-Z]{2})?$/)
  locale?: string;
}
