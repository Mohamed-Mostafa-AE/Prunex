# Default-branch protection

**Observed:** 6 November 2026  
**Ruleset:** `Protect main` (ID `26650516`)  
**Target:** default branch `main`

The active ruleset prevents branch deletion and force-pushes and requires pull requests. It currently requires **zero approvals** and has **no required status-check rule**. Passing CI runs are therefore evidence of validation, not merge restrictions.

## Latest successful checks

All six workflow runs validate commit `20973e346c8d78e852f65aca256ecc6f17dc1a1b`.

| Workflow / job context | Result |
|---|---|
| `build-and-test` and `test-training-data` | [Website workflow](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/42252559692) |
| `Analyze javascript-typescript`, `Analyze c-cpp` | [CodeQL workflow](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/42252559539) |
| `g++ regression suite`, `clang++ regression suite`, `GCC AddressSanitizer and UndefinedBehaviorSanitizer` | [Native workflow](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/42252559531) |
| `build` (Windows x64) | [Windows workflow](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/42252559544) |
| `build-and-compare` (WebAssembly parity) | [WebAssembly workflow](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/42252559596) |
| `validate` (backup tooling) | [Backup-tool workflow](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/42252559677) |

Every listed workflow completed successfully. The native CTest suite passed 46/46 across its four configurations; both CodeQL language jobs reported zero SARIF findings.

## Recommended rules

Require the current website/browser, CodeQL C/C++ and JavaScript/TypeScript, native compiler/sanitizer, WebAssembly, Windows x64, and backup-tool checks before merging to `main`. Keep the pull-request requirement. Enable strict status checks so the pull request is up to date with `main`. Require an independent approval only when a reviewer other than the author is available.

GitHub documents status checks as a merge gate in [Available rules for rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets) and [Creating rulesets for a repository](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/creating-rulesets-for-a-repository).

**Current status:** the required-check and review rules have not been configured. The connected GitHub integration used for this review supports reading repository/ruleset data and managing files and pull requests, but does not expose the repository-ruleset write operation. This settings change remains unverified and must not be represented as complete.
