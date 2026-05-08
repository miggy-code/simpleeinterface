# Testing

The suite is intentionally small and focused on the highest-risk workflow:
prompt quality for `{{personalization_hook}}`, plus safe integration contracts
for Airtable and Instantly.

## Commands

```bash
npm test
npm run typecheck
```

`npm test` compiles the test target to `.test-build` and runs Node's built-in
test runner. It does not require live API credentials and does not write to
Airtable or Instantly.

## Prompt Story Tests

Prompt scenarios live in `tests/prompt-stories`.

Each story should include:
- A realistic `Lead` fixture with `personalizationInsights`.
- The assigned campaign's first email template.
- The expected hook placement: `standalone_sentence` or `inline_fragment`.
- Acceptance criteria that reflect what a good model output must contain or
  avoid.
- A passing example output for the evaluator.

These tests are meant to help tune prompts without turning model behavior into
one brittle golden string. When prompt requirements change, update the prompt
file in `prompts/hook-generation` and the relevant story expectations together.

## Live LLM Report

The live report calls DeepSeek through `generateHook()` and prints:
- the rendered campaign email with the sampled hook inserted
- the raw model hook
- the model confidence and reasoning
- the campaign template and lead insights that produced that hook

Run it with:

```bash
DEEPSEEK_API_KEY=... npm run prompt-report
```

The script loads local `.env` / `.env.local` through Next's env loader, so a
key placed in the repo env file works without exporting it manually. In Vercel,
the script will read the configured project environment variables instead.
This is the path that exercises the actual LLM API call.

Set `VERBOSE_PROMPT=1` if you want the full generated prompt text as well.

## Integration Tests

`tests/integrations/airtable.test.ts` and `tests/integrations/instantly.test.ts`
mock `fetch` and verify request shape, auth headers, pagination, and payloads.
They are safe by default.

There is also an opt-in live read-only smoke test:

```bash
RUN_LIVE_READ_SMOKE=1 npm test
```

This requires Airtable and Instantly credentials. It only performs read calls:
`listLeads({ maxRecords: 1 })` and `listInstantlyCampaigns()`.
