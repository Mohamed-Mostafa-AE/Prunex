# GitHub default-branch protection setup

## Live check — 5 November 2026

The repository currently has an **Active** ruleset named **Protect main** (ID `26650516`) targeting the default branch. It enforces pull requests, prevents branch deletion, and blocks force-pushes. It currently requires **0 approvals** and has **no required status-check rule**. This means the ruleset is active, but a pull request can still be merged without the CI checks passing.

The connected GitHub integration can inspect this ruleset but does not expose a ruleset-write action. The repository owner must add the status-check rule in GitHub Settings → Rules → Rulesets. The recommended checks below are the next configuration step. Do not treat the current Active badge alone as proof that CI is enforced.

Open [Settings → Rules → Rulesets](https://github.com/Mohamed-Mostafa-AE/Prunex/settings/rules).

Create an active branch ruleset with:

- **Name:** Protect main
- **Enforcement:** Active
- **Target:** Include the default branch (`main`)
- **Restrict deletions:** On
- **Block force pushes:** On
- **Require a pull request before merging:** On
- **Required approvals:** 0 (this avoids locking a single-owner repository; request an independent review when one is available)
- **Require status checks:** On; require the checks listed below after the latest PR commit has reported them:
  - `build-and-test`
  - `test-training-data`
  - `Analyze c-cpp`
  - `Analyze javascript-typescript`
  - `build-and-compare`
  - `verify-archived-match`
  - `GCC AddressSanitizer and UndefinedBehaviorSanitizer`
  - `g++ regression suite`
  - `clang++ regression suite`
  - `build` (Windows x64)
- **Require branches to be up to date:** On, if the UI offers it.

Do not require the top-level `CodeQL` summary check until its check-run conclusion is confirmed; the successful individual CodeQL language analyses are the intended required checks.

After saving, open the ruleset and verify it shows **Active**, applies to `main`, and lists the required checks. Then try to push directly to `main` only in a safe test branch—not by attempting an actual protected-branch push.
