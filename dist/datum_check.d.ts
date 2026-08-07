import type { LatLng } from './geodetic.ts';
export interface DatumCheckRow {
    line: number;
    address: string;
    lat: number;
    lng: number;
}
export type DatumBucket = 'ok' | 'candidate' | 'unresolved' | 'no_address' | 'geocode_failed';
export type DatumVerdict = 'none' | 'correct_all' | 'abort' | 'unchecked';
export interface DatumRowResult {
    line: number;
    bucket: DatumBucket;
    distRawM?: number;
    distConvM?: number;
}
export interface DatumCheckResult {
    verdict: DatumVerdict;
    rows: DatumRowResult[];
    okCount: number;
    candidateCount: number;
    unresolvedCount: number;
    noAddressCount: number;
    geocodeFailedCount: number;
    correctedCount: number;
    /** verdict === 'correct_all' の場合のみ、line -> 補正後座標 を保持する。 */
    correctedCoords: Map<number, LatLng>;
    warnings: {
        line: number;
        message: string;
    }[];
    /** verdict === 'unchecked' の場合のみ設定される、利用者向けの説明文。 */
    note?: string;
}
export interface DatumCheckConfig {
    /** 行単位でOK/変換候補とみなす距離閾値（m）。 */
    rowThresholdMeters: number;
    /** バッチ全体をOK/変換扱いにする一致率の閾値（0-1）。 */
    batchRatioThreshold: number;
    /** ジオコーディングの同時実行数上限。 */
    concurrency: number;
    /** ジオコーディング1件あたりのタイムアウト（ms）。 */
    timeoutMs: number;
    /** バッチ判定を行うために必要な最小の判定対象行数。 */
    minJudgeableRows: number;
    /** 住所ありの行のうちこの割合以上でジオコーディングAPI呼び出し自体が失敗した場合、
     * APIが利用不能とみなしチェックをスキップする。 */
    serviceDownRatioThreshold: number;
    geocode: (address: string, opts?: {
        timeoutMs?: number;
    }) => Promise<LatLng | null>;
}
/**
 * CSV各行の座標を住所ジオコーディング結果と突き合わせ、日本測地系（Tokyo Datum）のズレを
 * 検出・補正する（bm-map-posting issue#16）。境界データの有無に依存しない汎用ロジック。
 */
export declare function checkAndCorrectDatum(rows: DatumCheckRow[], config?: Partial<DatumCheckConfig>): Promise<DatumCheckResult>;
