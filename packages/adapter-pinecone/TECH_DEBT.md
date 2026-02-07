# Technical Debt - @vectororm/adapter-pinecone

## Filter Translation Limitations

### Not Yet Implemented
- [ ] OR compound filters
- [ ] Nested AND/OR combinations
- [ ] Array operators (contains, overlaps)
- [ ] Text search operators

### Known Issues
- Complex nested filters may fail silently
- No validation of filter depth

### Future Enhancements
- [ ] Batch filter optimization
- [ ] Filter caching for repeated queries

## Metadata Operations
- Pinecone supports partial updates ✓
- No issues identified

## Iteration
- Pagination works but could be optimized for large collections

## Performance
- [ ] Connection pooling not implemented
- [ ] Retry logic could be improved
