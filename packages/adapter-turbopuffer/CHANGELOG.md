# @vectororm/adapter-turbopuffer

## 1.0.1

### Patch Changes

- [`eb7111b`](https://github.com/aviramroi/VectorORM/commit/eb7111b6cb9744594213113ae88dda853fbfdbd6) Thanks [@aviramroi](https://github.com/aviramroi)! - Fix Turbopuffer adapter to work with real API: correct v1/v2 endpoint versions, fix attribute format in upsert, use include_attributes instead of include_vectors, fix aggregation query format, and fix iterate rank_by casing

- Updated dependencies []:
  - @vectororm/core@1.0.1

## 1.0.0

### Minor Changes

- [`0f9e54d`](https://github.com/aviramroi/VectorORM/commit/0f9e54dddb0e14ed674935a40ad432fd52574107) Thanks [@aviramroi](https://github.com/aviramroi)! - Add `region` config option to TurbopufferAdapter. Sets the base URL to `https://{region}.turbopuffer.com` (e.g. `aws-us-east-1`, `gcp-us-central1`). Falls back to `TURBOPUFFER_REGION` env var.

### Patch Changes

- Updated dependencies []:
  - @vectororm/core@1.0.0

## 0.1.2

### Patch Changes

- [`c026678`](https://github.com/aviramroi/VectorORM/commit/c0266780fc13073b6b9e03d742076ca85c2d346c) Thanks [@aviramroi](https://github.com/aviramroi)! - Fix exports map in all adapter packages. The `require` and `import` paths now correctly point to `.cjs` and `.js` files matching the actual tsup output for `"type": "module"` packages.

- Updated dependencies []:
  - @vectororm/core@0.1.2
