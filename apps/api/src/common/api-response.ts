/** 全站统一响应体（组长规范）：HTTP 状态保留语义，业务状态看 code */
export interface ApiEnvelope<T> {
  code: 0 | number;
  message: string;
  data: T | null;
  traceId?: string;
}

/** 分页结果（与 common/pagination.dto.ts 配套） */
export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
