# Security Policy

For vulnerabilities, contact the repository owner privately through their GitHub profile. Never publish tokens, live screenshots with account identifiers, passwords, authentication cookies or private browser profiles in a public issue.

The application stores sensitive data in its local user-data folder. Browser sessions, encrypted secrets, billing snapshots and machine-specific configuration must not be checked into Git.

Provider browser pages should only be used by the account owner after consent and sign-in. Do not bypass CAPTCHAs or account protection. Automated metrics are best-effort and can be interrupted when provider pages change.

For security reports use fake test data, a version number, and reproduction steps; redact private values from any logs.
