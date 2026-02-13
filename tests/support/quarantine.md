# Flake Quarantine Policy

- Retry once in CI (`retries=1` in Playwright config).
- If a test fails first attempt and passes on retry, it is treated as flaky.
- If the same test is flaky in 3 consecutive CI runs, tag it with `@quarantine` and open a tracking issue.
- `@quarantine` tests are excluded from PR smoke and kept in nightly runs until stabilized.
