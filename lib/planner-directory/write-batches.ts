export type PlannerDirectoryDialect = "mysql" | "postgresql";

const DEFAULT_MAX_ROWS_PER_BATCH = 250;
const DEFAULT_MAX_PARAMS_PER_BATCH = 5000;

export function getPlannerDirectoryBatchSize(input: {
  columnCount: number;
  dialect: PlannerDirectoryDialect;
  maxRowsPerBatch?: number;
  maxParamsPerBatch?: number;
}): number {
  if (!Number.isFinite(input.columnCount) || input.columnCount <= 0) {
    throw new Error("columnCount must be greater than zero");
  }

  const maxRowsPerBatch =
    input.maxRowsPerBatch ??
    (input.dialect === "postgresql" ? DEFAULT_MAX_ROWS_PER_BATCH : DEFAULT_MAX_ROWS_PER_BATCH * 2);
  const maxParamsPerBatch =
    input.maxParamsPerBatch ??
    (input.dialect === "postgresql" ? DEFAULT_MAX_PARAMS_PER_BATCH : DEFAULT_MAX_PARAMS_PER_BATCH * 2);
  const paramLimitedRows = Math.max(1, Math.floor(maxParamsPerBatch / input.columnCount));

  return Math.max(1, Math.min(maxRowsPerBatch, paramLimitedRows));
}

export function chunkRowsForBatching<T>(rows: T[], batchSize: number): T[][] {
  if (!Number.isFinite(batchSize) || batchSize <= 0) {
    throw new Error("batchSize must be greater than zero");
  }

  const chunks: T[][] = [];

  for (let index = 0; index < rows.length; index += batchSize) {
    chunks.push(rows.slice(index, index + batchSize));
  }

  return chunks;
}
