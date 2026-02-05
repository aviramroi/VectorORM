# Technical Debt - @glyph/adapter-turbopuffer

## Filter Translation Limitations

### Not Yet Implemented
- [ ] Complex nested AND/OR combinations beyond two levels
- [ ] Text search operators (ContainsAllTokens, Glob, Regex)
- [ ] Array operators (ContainsAny when deeply nested)

### Known Issues
- Filter translation is functional but could be optimized
- No validation of filter depth or complexity

### Future Enhancements
- [ ] Batch filter optimization
- [ ] Filter caching for repeated queries

## Metadata Operations
- Turbopuffer supports partial updates via patch operations
- updateMetadata() uses fetch + patch pattern (could be optimized with patch_by_filter)

## Iteration
- Currently uses attribute-based pagination by ID
- Cursor-based pagination for vector queries not yet supported by Turbopuffer API
- For large collections, may need client-side batching

## Performance
- [ ] Connection pooling not implemented
- [ ] Retry logic could be improved
- [ ] Batch operations could be optimized (currently sequential)

## API Limitations
- Turbopuffer doesn't support direct fetch by IDs - must use query with filters
- No native cursor pagination for vector similarity searches
- Distance metric cannot be changed after namespace creation
