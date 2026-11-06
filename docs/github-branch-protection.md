# Default-branch protection

**Observed:** 6 November 2026  
**Ruleset:** `Protect main` (ID `26650516`)  
**Target:** default branch `main`

The active ruleset prevents branch deletion and force-pushes and requires pull requests. It currently requires **zero approvals** and has **no required status-check rule**. Passing CI runs are therefore evidence of validation, not merge restrictions.

## Latest successful checks

All six workflow runs validate commit `2c3b3834a2ce354470533f4dea1faea61bd01983`.

| Workflow / job context | Result |
|---|---|
| `build-and-test` and `test-training-data` | [Website workflow](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/42273408962) |
| `Analyze javascript-typescript`, `Analyze c-cpp` | [CodeQL workflow](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/42273409011) |
| `g++ regression suite`, `clang++ regression suite`, `GCC AddressSanitizer and UndefinedBehaviorSanitizer` | [Native workflow](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/42273408910) |
| `build` (Windows x64) | [Windows workflow](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/42273409049) |
| `build-and-compare` (WebAssembly parity) | [WebAssembly workflow](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/42273408989) |
| `validate` (backup tooling) | [Backup-tool workflow](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/42273408992) |

Every listed workflow completed successfully. The native CTest suite passed 46/46 across its four configurations; both CodeQL language jobs reported zero SARIF findings.

## Recommended policy

Require the current website/browser, CodeQL C/C++ and JavaScript/TypeScript, native compiler/sanitizer, WebAssembly, Windows x64, and backup-tool checks before merging to `main`. Keep the pull-request requirement. Enable strict status checks so the pull request is up to date with `main`. Require an independent approval only when a reviewer other than the author is available.

GitHub documents status checks as a merge gate in [Available rules for rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets) and [Creating rulesets for a repository](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/creating-rulesets-for-a-repository).

**Current state:** the required-check and review rules remain unconfigured. Passing workflow results are not enforced as merge requirements.
