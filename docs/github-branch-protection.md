# GitHub default-branch protection setup

The connected GitHub integration can read repository metadata but does not have the administrative write permission needed to create branch rules. Configure this once as the repository owner.

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
