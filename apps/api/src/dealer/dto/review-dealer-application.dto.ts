import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export const reviewStatuses = [
  'UNDER_REVIEW',
  'MORE_INFO_REQUIRED',
  'APPROVED',
  'REJECTED',
] as const;

export type ReviewStatus = (typeof reviewStatuses)[number];

export class ReviewDealerApplicationDto {
  @IsIn(reviewStatuses)
  status: ReviewStatus;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(500)
  remark?: string;
}

export class DealerApplicationQueryDto {
  @IsOptional()
  @IsIn(['SUBMITTED', ...reviewStatuses])
  status?: 'SUBMITTED' | ReviewStatus;
}
