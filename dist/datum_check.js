import { haversineDistanceMeters, tokyoDatumToWgs84 } from "./geodetic.js";
import { GeocodeServiceError, geocodeAddress, normalizeAddress } from "./geocode.js";
import { mapWithConcurrency } from "./concurrency.js";
const DEFAULT_CONFIG = {
    rowThresholdMeters: 150,
    batchRatioThreshold: 0.9,
    concurrency: 5,
    timeoutMs: 5000,
    minJudgeableRows: 3,
    serviceDownRatioThreshold: 0.5,
    geocode: geocodeAddress,
};
function unresolvedWarning(line) {
    return { line, message: `${line}行目は住所と座標の整合性を確認できませんでした` };
}
function geocodeFailedWarning(line) {
    return { line, message: `${line}行目はジオコーディングに失敗したため測地系を確認できませんでした` };
}
function stillMismatchedAfterCorrectionWarning(line) {
    return { line, message: `${line}行目は測地系補正後も住所と座標の整合性を確認できませんでした` };
}
/**
 * CSV各行の座標を住所ジオコーディング結果と突き合わせ、日本測地系（Tokyo Datum）のズレを
 * 検出・補正する（bm-map-posting issue#16）。境界データの有無に依存しない汎用ロジック。
 */
export async function checkAndCorrectDatum(rows, config = {}) {
    const cfg = { ...DEFAULT_CONFIG, ...config };
    const noAddressLines = [];
    const geocodeFailedLines = [];
    const classified = [];
    const addressedRows = rows.filter((r) => {
        if (r.address.trim() === '') {
            noAddressLines.push(r.line);
            return false;
        }
        return true;
    });
    await mapWithConcurrency(addressedRows, cfg.concurrency, async (row) => {
        const raw = { lat: row.lat, lng: row.lng };
        const converted = tokyoDatumToWgs84(raw);
        let expected;
        try {
            expected = await cfg.geocode(normalizeAddress(row.address), { timeoutMs: cfg.timeoutMs });
        }
        catch (err) {
            if (err instanceof GeocodeServiceError) {
                geocodeFailedLines.push(row.line);
                return;
            }
            throw err;
        }
        if (!expected) {
            classified.push({ line: row.line, bucket: 'unresolved', raw, converted });
            return;
        }
        const distRawM = haversineDistanceMeters(raw, expected);
        const distConvM = haversineDistanceMeters(converted, expected);
        let bucket;
        if (distRawM <= cfg.rowThresholdMeters) {
            bucket = 'ok';
        }
        else if (distConvM <= cfg.rowThresholdMeters) {
            bucket = 'candidate';
        }
        else {
            bucket = 'unresolved';
        }
        classified.push({ line: row.line, bucket, distRawM, distConvM, raw, converted });
    });
    const okRows = classified.filter((r) => r.bucket === 'ok');
    const candidateRows = classified.filter((r) => r.bucket === 'candidate');
    const unresolvedRows = classified.filter((r) => r.bucket === 'unresolved');
    const judgedCount = classified.length;
    const addressedCount = judgedCount + geocodeFailedLines.length;
    const baseCounts = {
        okCount: okRows.length,
        candidateCount: candidateRows.length,
        unresolvedCount: unresolvedRows.length,
        noAddressCount: noAddressLines.length,
        geocodeFailedCount: geocodeFailedLines.length,
    };
    function unchecked(note) {
        return {
            verdict: 'unchecked',
            rows: [],
            ...baseCounts,
            correctedCount: 0,
            correctedCoords: new Map(),
            warnings: [],
            note,
        };
    }
    if (addressedCount === 0) {
        return unchecked('CSVに住所が入力されていないため、測地系チェックをスキップしました');
    }
    if (geocodeFailedLines.length / addressedCount >= cfg.serviceDownRatioThreshold) {
        return unchecked('GSIジオコーディングAPIに接続できなかったため、測地系チェックをスキップしました');
    }
    if (judgedCount < cfg.minJudgeableRows) {
        return unchecked('判定対象の住所件数が少ないため、測地系チェックをスキップしました');
    }
    const okRatio = okRows.length / judgedCount;
    const candidateRatio = candidateRows.length / judgedCount;
    const buildRows = () => [
        ...classified.map((r) => ({ line: r.line, bucket: r.bucket, distRawM: r.distRawM, distConvM: r.distConvM })),
        ...noAddressLines.map((line) => ({ line, bucket: 'no_address' })),
        ...geocodeFailedLines.map((line) => ({ line, bucket: 'geocode_failed' })),
    ];
    if (okRatio >= cfg.batchRatioThreshold) {
        const warnings = [
            ...unresolvedRows.map((r) => unresolvedWarning(r.line)),
            ...geocodeFailedLines.map(geocodeFailedWarning),
        ];
        return {
            verdict: 'none',
            rows: buildRows(),
            ...baseCounts,
            correctedCount: 0,
            correctedCoords: new Map(),
            warnings,
        };
    }
    if (candidateRatio >= cfg.batchRatioThreshold) {
        const correctedCoords = new Map(rows.map((r) => [r.line, tokyoDatumToWgs84({ lat: r.lat, lng: r.lng })]));
        const stillMismatched = classified.filter((r) => (r.bucket === 'ok' || r.bucket === 'unresolved') && (r.distConvM ?? Infinity) > cfg.rowThresholdMeters);
        const warnings = [
            ...stillMismatched.map((r) => stillMismatchedAfterCorrectionWarning(r.line)),
            ...geocodeFailedLines.map(geocodeFailedWarning),
        ];
        return {
            verdict: 'correct_all',
            rows: buildRows(),
            ...baseCounts,
            correctedCount: rows.length,
            correctedCoords,
            warnings,
        };
    }
    return {
        verdict: 'abort',
        rows: buildRows(),
        ...baseCounts,
        correctedCount: 0,
        correctedCoords: new Map(),
        warnings: [],
    };
}
