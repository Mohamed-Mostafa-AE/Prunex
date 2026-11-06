# Engineering review

**Review date:** 6 November 2026  
**Scope:** native C++20 engine, Windows desktop application, browser experience, automated validation, repository documentation, and release controls.

## Review standard

This review focuses on functional correctness, design, complexity, test quality, naming, comments, and long-term maintainability. It uses the practical criteria in [Google Engineering Practices](https://google.github.io/eng-practices/review/): reviewers should assess design, behaviour, complexity, tests, readability, and whether a change improves code health.

## Strengths

- The native engine has a clear C++20 scope, a UCI interface, a repeatable five-position benchmark, and regression coverage for move generation, position state, search, and evaluation.
- Native tests run under GCC, Clang, sanitizers, and Windows x64. A separate WebAssembly target is checked against native results.
- The Windows interface runs engine search on a background thread and applies completed results on the UI thread. Cancellation and stale-result handling have explicit paths.
- Browser concerns are already split into focused modules for archive access, account feedback, review metrics, and challenge-token handling.
- The documentation distinguishes the native engine from the browser experience and preserves the separate licensing obligations for bundled browser components.
- Public materials do not make a native Elo or comparative match claim without a reproducible result.

## Findings

### Native engine and desktop application

The Windows GUI source currently includes the CLI implementation file after renaming its entry point. This keeps the build compact, but couples the desktop application to the command-line translation unit and makes the engine core harder to link and test independently.

**Recommendation:** extract the shared engine types and operations into a small core library with a public header. Link both the CLI and Windows GUI to that library. Keep the current build and regression coverage green during the extraction; do not combine it with unrelated feature work.

### Browser application structure

The website entry module is a large controller covering game interaction, review flow, account UI, archive updates, and preferences. Several supporting concerns already have dedicated modules, so there is a safe path to further separation.

**Recommendation:** move one cohesive responsibility at a time, starting with account-panel handling and archive rendering. Keep event ownership and module interfaces explicit, and run the complete Playwright suite after each extraction.

### Windows interaction coverage

The desktop smoke test's four depth-increase clicks were outside the plus button's client-coordinate hit area. The test therefore left the engine at its default depth, allowing the search to finish before the temporary thinking state could be observed.

**Correction:** the clicks now target the centre of the visible plus button. The Windows workflow must pass again on this updated commit before the interaction path is described as verified.

### Merge protection

The active Protect main ruleset prevents deletion and force-pushes and requires pull requests, but it does not require any status checks or approvals. Successful CI therefore is not currently a merge gate.

**Recommendation:** require the website/browser, CodeQL, native compiler and sanitizer, WebAssembly, Windows x64, and backup-tool checks on the default branch. Keep the pull-request requirement and enable branch-up-to-date enforcement. See [GitHub's ruleset documentation](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets).

### Release controls

Repository tests cannot establish real email delivery, correct guest archive ownership, successful data recovery, Windows 10/11 visual acceptance, or legal clearance. Those require controlled provider configuration, an identified account owner, a data-bearing restore test, a physical Windows device, and qualified review.

## Release position

Keep the release candidate separate from production until the latest code checks pass and the external controls have evidence. A build result is not evidence of playing strength, email delivery, archive migration, or disaster recovery.

## References

- [Google Engineering Practices — code review](https://google.github.io/eng-practices/review/)
- [Google Engineering Practices — what reviewers should look for](https://google.github.io/eng-practices/review/reviewer/looking-for.html)
- [GitHub Docs — available rules for rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets)
