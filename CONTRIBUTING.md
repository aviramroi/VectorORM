# Contributing to Glyph VectorORM

Thank you for your interest in contributing! This document provides guidelines for contributing to the project.

## Getting Started

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/<your-username>/VectorORM.git
   cd VectorORM
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Run the test suite to confirm everything works:
   ```bash
   npm test
   ```

## Development Workflow

### Branch Naming

- `feature/<name>` — New features
- `fix/<name>` — Bug fixes
- `docs/<name>` — Documentation changes
- `refactor/<name>` — Code refactoring

### Making Changes

1. Create a feature branch from `main`
2. Make your changes
3. Ensure tests pass: `npm test`
4. Ensure TypeScript compiles: `npm run lint`
5. Ensure build succeeds: `npm run build`
6. Commit with a descriptive message (see commit style below)
7. Push and open a Pull Request

### Commit Style

We use conventional commits:

```
feat(core): add new filter operator
fix(adapter-chroma): handle empty search results
docs: update API guide with enrichment examples
test(ingestion): add edge case tests for PDF loader
chore: update dependencies
```

### Code Style

- **TypeScript strict mode** — All code must compile with `strict: true`
- **Vitest** for testing — Write tests alongside implementations
- **TSDoc comments** on all public APIs
- No explicit `any` types unless unavoidable
- Prefer `interface` over `type` for object shapes
- Use `const` assertions where applicable

### Writing Tests

- Place tests in `packages/<name>/tests/` mirroring the `src/` structure
- Use descriptive test names: `it('should throw when collection does not exist')`
- Test both happy paths and error cases
- Use mocks for external dependencies (adapters, embedders, LLMs)

## Project Structure

```
packages/
├── core/                    # @glyph/core — Main package
│   ├── src/
│   │   ├── adapters/       # Abstract adapter base class
│   │   ├── client/         # RAGClient facade
│   │   ├── embedders/      # Embedder abstractions
│   │   ├── enrichment/     # Enrichment pipeline
│   │   ├── filters/        # Universal filter language
│   │   ├── ingestion/      # Document ingestion pipeline
│   │   ├── llm/            # LLM abstractions
│   │   ├── metadata/       # Metadata schema & builders
│   │   ├── query/          # Query composition layer
│   │   └── types/          # Core type definitions
│   └── tests/
├── adapter-chroma/          # @glyph/adapter-chroma
├── adapter-pinecone/        # @glyph/adapter-pinecone
└── adapter-turbopuffer/     # @glyph/adapter-turbopuffer
```

## Adding a New Adapter

1. Create `packages/adapter-<name>/` with the standard package structure
2. Extend `VectorDBAdapter` from `@glyph/core`
3. Implement all abstract methods
4. Add filter translation for the target database
5. Write tests covering all operations
6. Add a README with installation and usage instructions
7. Add an example script in `examples/`

## Reporting Issues

- Use the [bug report template](.github/ISSUE_TEMPLATE/bug_report.md) for bugs
- Use the [feature request template](.github/ISSUE_TEMPLATE/feature_request.md) for new features
- Include reproduction steps, expected behavior, and environment details

## License

By contributing, you agree that your contributions will be licensed under the Apache License 2.0.
