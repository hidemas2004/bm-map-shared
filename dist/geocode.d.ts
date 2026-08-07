import type { LatLng } from './geodetic.ts';
/**
 * ジオコーディングAPI自体の呼び出し失敗（ネットワークエラー・タイムアウト・非2xx・
 * レスポンス形式異常）を表す。「該当住所なし」（=null）とは区別する。
 */
export declare class GeocodeServiceError extends Error {
    constructor(message: string, options?: {
        cause?: unknown;
    });
}
/**
 * ジオコーディングの成功率を上げるための住所正規化（v1）。
 * 丁目・番地・号の表記ゆれ吸収や漢数字変換は、実データで不一致が確認された場合に追加する。
 */
export declare function normalizeAddress(address: string): string;
/**
 * 国土地理院 地名検索API（無料・APIキー不要・WGS84準拠）で住所を正引きジオコーディングする。
 * 該当住所が見つからない場合はnull（=API呼び出し自体は成功）を返す。
 * API呼び出し自体が失敗した場合はGeocodeServiceErrorをthrowする。
 */
export declare function geocodeAddress(address: string, opts?: {
    timeoutMs?: number;
}): Promise<LatLng | null>;
