# Default-branch protection

**Observed:** 9 November 2026  
**Ruleset:** Protect main (ID 26650516)  
**Target:** default branch main

The active ruleset prevents branch deletion and force-pushes and requires pull requests. It currently requires **zero approvals** and has **no required status-check rule**. Passing local or CI tests therefore is not enforced as a merge condition.

## Current-main validation

Current main commit: 715639559b91d0b8b359a5d3e7a2619075c2f144.

Fresh local validation on 9 November 2026 passed 47/47 native CTest cases under GCC 11.5 Release, Clang 15.0.7 Release, and GCC 11.5 AddressSanitizer/UndefinedBehaviorSanitizer.

The associated GitHub Actions workflow conclusions were unsuccessful for the native compiler/sanitizer workflow, the Windows x64 workflow, and CodeQL. The available job details did not establish a full green matrix. See [native](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/42672729254), [Windows](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/42672729455), and [CodeQL](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/42672729565).

## Historical successful checks

The following workflows passed for the earlier 6 November release-candidate source revision. They are retained as historical validation records and do not replace checks on the current release commit.

| Workflow / job context | Historical evidence |
|---|---|
| Website build, unit tests, Playwright, and training-data checks | [Run 42280861610](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/42280861610) |
| GCC, Clang, and sanitizer matrix | [Run 42280861589](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/42280861589) |
| Windows x64 build and desktop smoke test | [Run 42280861974](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/42280861974) |
| WebAssembly build and parity | [Run 42280861737](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/42280861737) |
| CodeQL C/C++ and JavaScript/TypeScript | [Run 42280861678](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/42280861678) |
| Backup-tool validation | [Run 42280861766](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/42280861766) |

## Recommended policy

Require successful website/browser, native compiler/sanitizer, Windows x64, WebAssembly parity, CodeQL C/C++ and JavaScript/TypeScript, and backup-tool checks before merging to main. Keep the pull-request requirement. Enable strict status checks so the branch must be up to date with main. Require an independent approval when another reviewer is available.

GitHub documents status checks as a merge gate in [Available rules for rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets) and [Creating rulesets for a repository](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/creating-rulesets).

**Current state:** required checks and review rules remain unconfigured. The ruleset must be updated and re-read before the repository can rely on CI as an enforced merge gate.