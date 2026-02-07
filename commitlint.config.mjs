export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [
      2,
      'always',
      [
        'core',
        'adapter-chroma',
        'adapter-pinecone',
        'adapter-turbopuffer',
        'deps',
        'ci',
        'release',
      ],
    ],
    'scope-empty': [0], // allow commits without scope
  },
};
