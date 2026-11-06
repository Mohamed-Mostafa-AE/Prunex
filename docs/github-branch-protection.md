# Default-branch protection

**Observed:** 6 November 2026  
**Ruleset:** `Protect main` (ID `26650516`)  
**Target:** default branch `main`

The active ruleset prevents branch deletion and force-pushes and requires pull requests. It currently has **no required status-check rule**. The workflows listed below pass on commit `1739fc8356c72886796841012f22267e8dd2efdb`, but GitHub does not yet enforce them as merge requirements.

## Latest successful checks

| Check context | Result |
|---|---|
| `build-and-test` | Success |
| `test-training-data` | Success |
| `Analyze c-cpp` | Success |
| `Analyze javascript-typescript` | Success |
| `build-and-compare` | Success |
| `g++ regression suite` | Success |
| `GCC AddressSanitizer and UndefinedBehaviorSanitizer` | Success |
| `clang++ regression suite` | Success |
| `build` (Windows x64) | Success |
| `validate` (backup tooling) | Success |

The CodeQL language analyses are separate check runs. The top-level CodeQL summary is not needed as an additional requirement when both language analyses are required.

## Administration status

The connected GitHub integration exposes read access to repository rulesets but does not have repository-administration write access. The ruleset therefore remains unchanged. GitHub documents required status checks as a merge gate: [available rules for rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets) and [creating rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/creating-rulesets-for-a-repository).
