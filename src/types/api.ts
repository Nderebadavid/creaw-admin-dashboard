export interface ApiEnvelope<T> {
  resultCode: number;
  success: boolean;
  message: string;
  data: T;
}

export interface PaginatedData<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  /** Counts per value of the fields named by `facet=`, when asked for. */
  facets?: Record<string, Record<string, number>>;
}
