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
    "bm-map-datum-check": "github:hidemas2004/bm-map-shared#v1.0.1"
  }
}
```

`src/`はTypeScriptソースとして開発用に保持しつつ、消費側には`dist/`配下のコンパイル済みJS（`main`/`types`）
を配布する。理由: wrangler（esbuild）はTypeScriptソースを直接バンドルできるが、`node scripts/foo.mjs`の
ような素のNode.js実行はnode_modules配下のTypeScriptファイルの型ストリッピングをサポートしないため
（`ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING`）、両方の消費形態（wranglerバンドル / 素のNodeスクリプト）
に対応するため`dist/`をコミットしている。npmレジストリへのpublishは行わない。

## 更新の流れ

1. このリポジトリで`src/`のロジックを修正し、テスト（`npm test`）・型チェック（`npx tsc --noEmit`）を通す。
2. `npm run build` で `dist/` を再生成し、コミットする（**`dist/`の再生成を忘れないこと**。ここを忘れると
   消費側は古いロジックのまま更新されない）。
3. `package.json`の`version`を上げ、新しいタグ（例: `v1.0.2`）を切ってpushする。
4. 消費側（`bm-map-posting` / `bm-map-poster`）の `package.json` の参照タグを更新し、`npm install` する。

## テスト・ビルド

```
npm test        # node --test src/*.test.ts
npx tsc --noEmit
npm run build    # dist/ を再生成（コミット対象）
```
