/**
 * items を最大 limit 件まで同時実行しつつ fn を適用する。
 * Cloudflare Workersのsubrequest数上限（無料プラン目安50、有料1000）を踏まえ、
 * 呼び出し側（datum_check.ts）では控えめな並列数をデフォルトにする。
 */
export declare function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]>;
