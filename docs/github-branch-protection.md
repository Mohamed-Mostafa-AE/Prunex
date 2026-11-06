# Default-branch ruleset

The active repository ruleset **Protect main** (ID `26650516`) applies to the default branch. Its current configuration prevents branch deletion and force-pushes and requires pull requests. It still has zero required status checks.

The latest successful commit `2ff47018cd45f9fcfeafe9c492c55fd8e88855e4` reported these GitHub check-run names:

| Required status check | Latest result |
|---|---|
| `build-and-test` | success |
| `test-training-data` | success |
| `Analyze c-cpp` | success |
| `Analyze javascript-typescript` | success |
| `GCC AddressSanitizer and UndefinedBehaviorSanitizer` | success |
| `clang++ regression suite` | success |
| `g++ regression suite` | success |
| `build` (Windows x64) | success |
| `build-and-compare` (WebAssembly) | success |
| `validate` (backup tooling) | success |

The checks above are the exact contexts reported by the current GitHub Actions run. Require these contexts on `main`, enable branch-up-to-date enforcement, and retain the existing pull-request, no-deletion, and no-force-push rules.

The connected GitHub integration has read-only ruleset access; it cannot write repository-administration settings. Therefore the ruleset itself has not been changed from this workspace. GitHub's documented update endpoint requires repository Administration: write permission. See [GitHub's repository rulesets API](https://docs.github.com/en/rest/repos/rules#update-a-repository-ruleset).

After updating the ruleset, verify on the GitHub Settings → Rules page that every context appears under required status checks and that the ruleset remains Active.
