# CoParrent Next 10 Tasks

Last updated: 2026-04-01

Ranked by immediate value after the docs cleanup and current green local verification baseline.

## 1. Complete Real-Device Push/PWA Validation

Owner: User-assisted

- Test install and push behavior on iOS, Android, and desktop.
- Save dated evidence instead of summarizing expected behavior from code alone.

## 2. Confirm Deployed Auth And Origin Posture

Owner: User-assisted

- Confirm captcha remains correctly configured in deployed auth flows.
- Confirm localhost-origin allowances are limited to the intended environments.
- Treat this as a deployment check, not a repo-complete item.

## 3. Decide The Final Passkey Posture

Owner: Mixed

- Decide whether passkeys stay hidden, remain partial, or become a tracked launch blocker.
- Keep launch messaging aligned with actual deployment support.

## 4. Refresh Live Evidence After Any Meaningful Deploy

Owner: Mixed

- Re-run the relevant smoke and workflow verifiers after material production-facing changes.
- Keep the evidence log current so the project story stays tied to actual proof.

## 5. Verify The Deployed Object-Lock Export Path

Owner: Mixed

- Run create, download, and verify flows against the deployed export functions after the new storage path is released.
- Capture dated evidence for S3 object versioning and retention metadata instead of relying on repo-only claims.

## 6. Decide The Legacy Export Artifact Policy

Owner: Mixed

- Decide whether pre-cutover export artifacts remain readable legacy records or are migrated into the newer immutable-storage posture.
- Keep buyer and operator docs explicit about the difference until that decision is closed.

## 7. Decide The Call-Evidence Expansion Boundary

Owner: Mixed

- Decide whether call evidence remains session/event history only or grows into a dedicated media export/reporting surface.
- Do not let product copy imply call recording or transcripts unless they are actually built.

## 8. Prepare A Stable Buyer Demo Target

Owner: Mixed

- Keep one clean demo family and a short walkthrough path ready.
- Avoid depending on ad hoc test accounts or fragile setup steps during a demo.

## 9. Capture Buyer Demo Assets

Owner: Mixed

- Capture current screenshots from the strongest public and in-app surfaces.
- Record a short walkthrough that matches the current repo and evidence log.

## 10. Tighten The Buyer Package

Owner: Mixed

- Keep the package concise.
- Remove duplicated status language and stale claims whenever the repo changes.
