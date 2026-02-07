# Technical Debt - @vectororm/adapter-chroma

## Filter Translation Limitations

### Implemented
- [x] Basic operators (eq, ne, gt, gte, lt, lte)
- [x] Array operators (in, nin)
- [x] AND compound filters
- [x] OR compound filters
- [x] Nested compound filters

### Not Yet Implemented
- [ ] Array operators (contains, overlaps)
- [ ] Text search operators
- [ ] Complex array field filtering

### Known Issues
- None identified yet

### Future Enhancements
- [ ] Filter validation and optimization
- [ ] Filter caching for repeated queries

## Metadata Operations
- Chroma supports partial updates ✓
- Update method works per-record (not batched)

## Iteration
- Offset/limit pagination works well
- Could optimize with cursor-based approach if Chroma adds support

## Performance
- [ ] Connection pooling not implemented
- [ ] Retry logic could be improved
- [ ] Collection cache helps reduce API calls

## Self-Hosted Support
- [x] Configurable host/port
- [x] SSL/TLS support
- [x] Optional authentication
- [ ] Multi-tenancy support (partial)
- [ ] Custom headers support

## Chroma-Specific Features Not Yet Used
- [ ] Document storage alongside embeddings
- [ ] Chroma's built-in embedding functions
- [ ] Collection sharing/permissions
- [ ] Query result ordering options
