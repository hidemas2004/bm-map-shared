export interface LatLng {
    lat: number;
    lng: number;
}
/**
 * 日本測地系（Tokyo Datum）からWGS84への簡易変換（国土地理院公式の近似式）。
 * 誤差は数m〜十数m程度残る。ミリ〜メートル単位の精度が必要な場合はTKY2JGDへの
 * 置き換えを検討する（bm-map-posting issue#16では非対象・保留事項）。
 */
export declare function tokyoDatumToWgs84({ lat, lng }: LatLng): LatLng;
export declare function haversineDistanceMeters(a: LatLng, b: LatLng): number;
