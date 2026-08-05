# Security Policy

Thank you for taking the time to help keep Okaform secure. This document explains how to report security vulnerabilities, what to expect after reporting, and what is in-scope for testing.

## Reporting a Vulnerability

Please report security issues to: [patrickpeters911@gmail.com](mailto:patrickpeters911@gmail.com) (preferred) or use GitHub Security Advisories.

If you need to share sensitive details (PoC, exploit code), mention this in your report and we will coordinate a secure channel for sharing them (for example, by providing an encryption key or alternative secure channel).

### What to include in your report

- A clear description of the issue and the affected component(s).
- Steps to reproduce, including minimal proof-of-concept or PoC code if available.
- Impact assessment (e.g., confidentiality, integrity, availability) and any CVSS score you believe is appropriate.
- Your contact information and preferred disclosure timeline.

## Scope

In-scope:

- Backend API code in `backend/` (HTTP endpoints, auth flows, business logic)
- Frontend code in `frontend/` (client-side logic that affects user data or auth)
- Smart-contract / on-chain programs in `okaform-program/` (program logic and account handling)
- Infrastructure as code used by the project (if present)

Out-of-scope:

- Third-party libraries or services (report to the relevant project upstream)
- Client machines, social engineering, or physical attacks against our offices

If you are unsure whether something is in-scope, please report it and we will triage.

## Supported Versions

We accept reports for all actively maintained branches and releases. If your report affects a version no longer maintained, we may still respond but we prioritize supported versions.

## Acknowledgement and Response Time

- We will acknowledge receipt of your report within 7 calendar days.
- We aim to provide an initial triage (severity and action plan) within 14 calendar days.
- For critical vulnerabilities we will prioritize fixes and notify you about progress more frequently.

## Disclosure Policy

- We prefer coordinated disclosure: please give us time to investigate and remediate before you publish details publicly.
- If you intend to disclose publicly, contact us to coordinate timelines and ensure users are protected before publication.

## Safe Harbor

If you follow this policy and act in good faith to avoid privacy violations, data destruction, or service disruption, Okaform will not pursue legal action against you for your security research related to this project. Do not exploit discovered vulnerabilities for personal gain; instead, report them promptly.

## Rewards

We do not currently operate a public bug bounty program. If you believe your report qualifies for compensation, include a suggested reward in your report and we will review it case-by-case.

## Contact & Escalation

- Primary: [patrickpeters911@gmail.com](mailto:patrickpeters911@gmail.com)
- If you do not receive a response within 7 days, please open a GitHub issue labeled `security` or escalate by emailing [patrickpeters911@gmail.com](mailto:patrickpeters911@gmail.com) with the subject `SECURITY ESCALATION`.

## Thank you

We appreciate responsible disclosure and will credit researchers (unless you request anonymity) who help improve the security of Okaform.
