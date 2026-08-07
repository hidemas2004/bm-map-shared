# bm-map-shared

`bm-map-posting`（ポスティング管理）・`bm-map-poster`（ポスター掲示板管理）の両プロジェクトで共有する、
自治体オープンデータに混入する日本測地系（Tokyo Datum）と世界測地系（WGS84/JGD2000）のズレを
検出・補正するための汎用ロジック。

経緯: `bm-map-posting` issue#16 で、大和市配布の投票所CSVの座標が旧日本測地系で提供されており、
地図側が前提とする世界測地系との間で最大680m程度のズレが生じることが判明した。同根の問題が
`bm-map-poster`（issue#3）にも影響していたため、ロジックをこのリポジトリに切り出し、両プロジェクトから
`package.json`のgit依存（`github:hidemas2004/bm-map-shared#<tag>`）として参照する。

自治体・データセット固有の情報（DBスキーマ、CSV形式、住所の構造化方法など）には一切依存しない。
入力は `{ line, address, lat, lng }` の配列のみ。

## モジュール構成

- `src/geodetic.ts` — `tokyoDatumToWgs84()`（国土地理院公式の簡易変換式）、`haversineDistanceMeters()`
- `src/geocode.ts` — 国土地理院 地名検索API（無料・APIキー不要・WGS84準拠）での正引きジオコーディング、住所正規化
- `src/concurrency.ts` — 同時実行数を絞ったマッピングユーティリティ（ジオコーディングAPI呼び出し用）
- `src/datum_check.ts` — 行単位の距離判定とバッチ単位の判定・補正方針決定（`checkAndCorrectDatum()`）
- `src/index.ts` — 公開API

## 使い方

```ts
import { checkAndCorrectDatum } from 'bm-map-datum-check';

const result = await checkAndCorrectDatum([
  { line: 1, address: '神奈川県大和市中央4-1-1', lat: 35.4717, lng: 139.4549 },
  // ...
]);

if (result.verdict === 'correct_all') {
  // result.correctedCoords: Map<line, {lat, lng}> を使って全行を補正
}
```

判定ロジックの詳細（行単位のOK/変換候補/不一致の閾値、バッチ単位の一致率閾値など）は
`src/datum_check.ts` の `DatumCheckConfig` を参照。

## 消費側プロジェクトでの導入

```json
{
  "dependencies": {
    "bm-map-datum-check": "github:hidemas2004/bm-map-shared#v1.0.0"
  }
}
```

wrangler（esbuild）がTypeScriptソースを直接バンドルするため、このリポジトリ自体はビルド成果物
（dist/）を持たない。npmレジストリへのpublishも行わない。

## 更新の流れ

1. このリポジトリでロジックを修正し、テスト（`npm test`）・型チェック（`npx tsc --noEmit`）を通す。
2. 新しいタグ（例: `v1.1.0`）を切ってpushする。
3. 消費側（`bm-map-posting` / `bm-map-poster`）の `package.json` の参照タグを更新し、`npm install` する。

## テスト

```
npm test        # node --test src/*.test.ts
npx tsc --noEmit
```
