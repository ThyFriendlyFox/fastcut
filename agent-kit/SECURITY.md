# SECURITY.md

- Report vulnerabilities privately via GitHub Security Advisories
  ("Report a vulnerability" on the Security tab of
  ThyFriendlyFox/fastcut). **Never open a public issue for a
  vulnerability.**
- FastCut has no server. Clips, songs and projects stay in the
  browser. A change that sends user media off the device is
  security-shaped work.
- Acknowledgment within 72 hours; fix-or-plan within 14 days;
  coordinated disclosure after a fix ships.
- Supported: latest minor release, unless stated otherwise.
- Secrets never enter the repo — not code, config, fixtures, or history.
  CI uses Actions secrets; local dev uses untracked `.env` with a
  committed `.env.example`.
- For the agent: security-shaped work overrides normal routing. A
  security fix may ship out-of-band as a patch release at any time,
  without waiting for the weekly cycle.
