# Contributing to VectorORM

Thank you for your interest in contributing! Whether you're fixing a bug, adding a new adapter, or improving docs — every contribution helps.

## Where to Start

- Browse [issues labeled `good first issue`](https://github.com/aviramroi/VectorORM/labels/good%20first%20issue) for beginner-friendly tasks
- Check [issues labeled `help wanted`](https://github.com/aviramroi/VectorORM/labels/help%20wanted) for features that need contributors
- Comment on an issue to claim it before starting work

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
6. Add a changeset (see below)
7. Commit with a descriptive message (see commit style below)
8. Push and open a Pull Request

### Adding a Changeset

Every PR that changes runtime code or fixes a bug should include a changeset:

```bash
npm run changeset
```

You'll be prompted to:
1. Select which packages are affected
2. Choose the bump type (`patch` for fixes, `minor` for features, `major` for breaking changes)
3. Write a short summary of the change

This creates a file in `.changeset/` — commit it with your PR. When merged, the release workflow automatically versions and publishes to npm.

**When to skip a changeset:** Pure docs changes, CI tweaks, or test-only changes don't need one.

### Commit Style

We use [Conventional Commits](https://www.conventionalcommits.org/), enforced by commitlint via a git hook.

**Format:** `type(scope): description`

**Types:** `feat`, `fix`, `docs`, `test`, `chore`, `refactor`, `perf`, `ci`

**Scopes:** `core`, `adapter-chroma`, `adapter-pinecone`, `adapter-turbopuffer`, `deps`, `ci`, `release` (or omit scope)

```
feat(core): add NOT compound filter
fix(adapter-chroma): handle empty search results
docs: update API guide with enrichment examples
test(core): add edge case tests for PDF loader
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
├── core/                    # @vectororm/core — Main package
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
├── adapter-chroma/          # @vectororm/adapter-chroma
├── adapter-pinecone/        # @vectororm/adapter-pinecone
└── adapter-turbopuffer/     # @vectororm/adapter-turbopuffer
```

## Adding a New Adapter

This is a great way to contribute! See [issue #2](https://github.com/aviramroi/VectorORM/issues/2) (Qdrant) or [issue #6](https://github.com/aviramroi/VectorORM/issues/6) (pgvector) for open adapter requests.

1. Create `packages/adapter-<name>/` with the standard package structure
2. Extend `VectorDBAdapter` from `@vectororm/core`
3. Implement all abstract methods
4. Add filter translation for the target database
5. Write unit tests covering all operations
6. Add a README with installation and usage instructions
7. Add an example in `cookbooks/`

Use any existing adapter as a template — `adapter-turbopuffer` is the simplest.

## Adding a New Embedder or LLM Client

Same pattern as adapters:

1. Create `packages/embedder-<name>/` or `packages/llm-<name>/`
2. Extend the abstract base class (`Embedder` or `LLMClient`) from `@vectororm/core`
3. Use `fetch` directly — avoid SDK dependencies to keep packages lightweight
4. Accept API keys via constructor config or environment variables
5. Unit tests with mocked HTTP responses
6. README with installation and usage

## Reporting Issues

- Use the [bug report template](.github/ISSUE_TEMPLATE/bug_report.md) for bugs
- Use the [feature request template](.github/ISSUE_TEMPLATE/feature_request.md) for new features
- Include reproduction steps, expected behavior, and environment details

## License

By contributing, you agree that your contributions will be licensed under the Apache License 2.0.
