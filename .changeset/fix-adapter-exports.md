---
"@vectororm/adapter-chroma": patch
"@vectororm/adapter-pinecone": patch
"@vectororm/adapter-turbopuffer": patch
---

Fix exports map in all adapter packages. The `require` and `import` paths now correctly point to `.cjs` and `.js` files matching the actual tsup output for `"type": "module"` packages.
