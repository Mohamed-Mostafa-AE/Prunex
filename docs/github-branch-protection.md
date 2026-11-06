# Default-branch protection

**Observed:** 6 November 2026  
**Ruleset:** `Protect main` (ID `26650516`)  
**Target:** default branch `main`

The active ruleset prevents branch deletion and force-pushes and requires pull requests. It currently requires **zero approvals** and has **no required status-check rule**. The passing CI results below therefore provide validation evidence but are not enforced as merge conditions.

## Latest successful checks

All runs below validate commit `4591190f6eea8ab01470ced2913986277dbb78d5`.

| Check context | Result |
|---|---|
| `build-and-test` (website and browser) | Success |
| `test-training-data` | Success |
| `Analyze c-cpp` | Success |
| `Analyze javascript-typescript` | Success |
| `build-and-compare` (WebAssembly parity) | Success |
| `g++ regression suite` | Success |
| `GCC AddressSanitizer and UndefinedBehaviorSanitizer` | Success |
| `clang++ regression suite` | Success |
| `build` (Windows x64) | Success |
| `validate` (backup tooling) | Success |

Run records: [website](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/42251005146), [native compiler and sanitizers](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/42251005141), [Windows x64](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/42251005114), [WebAssembly](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/42251005158), [CodeQL](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/42251005205), [backup tooling](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/42251005120).

## Required merge controls

Require the website/browser checks, both CodeQL language analyses, native compiler and sanitizer checks, WebAssembly parity, Windows x64, and backup-tool validation before merging to `main`. Retain the pull-request requirement and consider requiring at least one approval for protected changes.

GitHub documents required status checks as a ruleset merge gate: [available rules for rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets) and [creating rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/creating-rulesets-for-a-repository).

**Current status:** the active ruleset has not been updated to require these checks or approvals.
