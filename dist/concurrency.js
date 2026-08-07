/**
 * items を最大 limit 件まで同時実行しつつ fn を適用する。
 * Cloudflare Workersのsubrequest数上限（無料プラン目安50、有料1000）を踏まえ、
 * 呼び出し側（datum_check.ts）では控えめな並列数をデフォルトにする。
 */
export async function mapWithConcurrency(items, limit, fn) {
    const results = new Array(items.length);
    let cursor = 0;
    async function worker() {
        while (cursor < items.length) {
            const index = cursor++;
            results[index] = await fn(items[index], index);
        }
    }
    const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
    await Promise.all(workers);
    return results;
}
