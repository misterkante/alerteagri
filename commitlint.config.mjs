// Conventional commits, in English, with no attribution to an assistant.
const AI_ATTRIBUTION = /co-authored-by:.*(claude|anthropic|copilot|gemini|openai|chatgpt|cursor)|generated with|claude-session:|\bnoreply@anthropic\.com\b/i;

export default {
  extends: ['@commitlint/config-conventional'],
  plugins: [
    {
      rules: {
        'no-ai-attribution': ({ raw }) => [!AI_ATTRIBUTION.test(raw ?? ''), 'a commit carries no assistant attribution or co-author line'],
      },
    },
  ],
  rules: {
    'no-ai-attribution': [2, 'always'],
    'scope-enum': [2, 'always', ['api', 'web', 'db', 'ci', 'docs', 'deps', 'e2e', 'repo']],
    // No capital at the start of the subject; proper nouns inside it stay allowed.
    'subject-case': [2, 'never', ['sentence-case', 'start-case', 'pascal-case', 'upper-case']],
    'header-max-length': [2, 'always', 100],
    'body-max-line-length': [2, 'always', 100],
  },
};
