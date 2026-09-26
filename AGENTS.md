<!-- forge:start -->
## Forge

This project is built with the Forge pipeline. Load the `forge-pipeline` skill
before any feature work. Forge scripts: `/home/misterkante/dev/forge/scripts/`.

- Settings: `.forge/config.json` (db_phase, commits, validation, package_roots).
- Living docs in `docs/`: SPEC, STATE, REPORT, KNOWN_ISSUES, architecture, db ledger.
- Never commit unless `.forge/config.json` says `"commits": "on-feature-branch"`
  or the user asks in the conversation. No AI attribution in commits or PRs.
- A prompt ending with a question mark is a question: answer, do not build.
- Code in English; docs and product text in fr.
<!-- forge:end -->
