# Document Alignment Report

_Purpose_: Track where project documents are **out of alignment**, what the mismatch is, and the most likely reason (stale summary, mixed-era statement, naming drift, etc.).

_Scope_: This report is based on a read-only review of the repo content. It does not change any project behavior.

---

## Summary

The primary misalignments identified are:

- **README drift**: `README.md` contains “verified” numbers and metadata that diverge from `docs/project/CURRENT_STATUS.md`, despite stating it should not diverge.
- **Captcha posture wording conflict**: `README.md` contains both “captcha required in production” and “temporarily disabled for QA” without clearly scoping environment, which conflicts with the repo’s stated deployment/auth posture expectations.
- **Canonical URL vs env URL tension**: project docs emphasize keeping `https://www.coparrent.com` canonical while apex behavior settles; `BRANDED_GOOGLE_AUTH_SETUP.md` suggests apex `https://coparrent.com` for “public app URLs,” which may be correct for env/constants but is not explained as distinct from “canonical public URL.”
- **Messaging export verify-mode naming drift**: a verify mode named `provided_manifest_json` is treated as “provided evidence package JSON” in the edge function, implying a leftover/renamed mode.

---

## Findings (detailed)

### 1) Test-count “verified” numbers disagree

- **Documents in conflict**
  - [`README.md`](E:/Files/.coparrent/README.md): “Local tests currently pass with **30** test files and **119** targeted regression tests.”
  - [`docs/project/CURRENT_STATUS.md`](E:/Files/.coparrent/docs/project/CURRENT_STATUS.md): “`npm run test -- --run` passes … with **43** test files and **160** tests.”
- **Evidence**
  - `README.md`: lines 166–168
  - `CURRENT_STATUS.md`: lines 10–13
- **Why out of alignment**
  - **README drift**: README explicitly says this section “should not diverge” from `CURRENT_STATUS.md`, but the counts were not updated when the suite grew (`README.md` lines 152–153).

---

### 2) README “Last Verified Build” date lags CURRENT_STATUS verification date

- **Documents in tension**
  - [`README.md`](E:/Files/.coparrent/README.md): “Last Verified Build: 2026-03-28.”
  - [`docs/project/CURRENT_STATUS.md`](E:/Files/.coparrent/docs/project/CURRENT_STATUS.md): build/lint/test passing **as of March 30, 2026**.
- **Evidence**
  - `README.md`: lines 154–160
  - `CURRENT_STATUS.md`: lines 10–13
- **Why out of alignment**
  - **Stale README metadata fields**: the README date fields appear not to have been updated when CURRENT_STATUS was updated.

---

### 3) Captcha posture: “required in production” vs “temporarily disabled for QA”

- **Documents in conflict**
  - [`README.md`](E:/Files/.coparrent/README.md) states production auth should require captcha by default, and deployed environments must keep hCaptcha configured.
  - [`README.md`](E:/Files/.coparrent/README.md) also lists “Supabase Auth Captcha … ⚠️ Temporarily disabled for QA.”
  - [`docs/security/SECURITY_MODEL.md`](E:/Files/.coparrent/docs/security/SECURITY_MODEL.md) states production auth captcha defaults to required and should remain configured in deployed environments.
- **Evidence**
  - README “Still Risky”: lines 179–182
  - README “3rd Party Connections” table: lines 579–585
  - SECURITY_MODEL “Deployment/Auth Posture”: lines 192–205
- **Why out of alignment**
  - **Mixed-era statement**: the README carries a QA exception statement alongside the newer “strict by default” posture without clearly scoping which environment is being described. A reader can interpret this as an intentional production weakness unless clarified.

---

### 4) Canonical public URL (`www`) vs “Public app URLs should remain apex”

- **Documents in tension**
  - Project status/checklists consistently say keep `https://www.coparrent.com` as the canonical public URL until apex host is confirmed stable.
  - Branded auth setup suggests multiple “Public app URLs should remain” set to `https://coparrent.com` (apex).
- **Evidence**
  - Canonical `www` rule: [`docs/project/DEPLOYMENT_AUTH_CONFIRMATION_CHECKLIST.md`](E:/Files/.coparrent/docs/project/DEPLOYMENT_AUTH_CONFIRMATION_CHECKLIST.md) line 9
  - Canonical `www` reiterated: [`docs/project/CURRENT_STATUS.md`](E:/Files/.coparrent/docs/project/CURRENT_STATUS.md) line 58
  - Apex in “Public app URLs should remain”: [`docs/project/BRANDED_GOOGLE_AUTH_SETUP.md`](E:/Files/.coparrent/docs/project/BRANDED_GOOGLE_AUTH_SETUP.md) lines 163–170
- **Why out of alignment**
  - Likely **two different concepts are being described without being labeled**:
    - **Canonical public URL for users/buyers** (what you advertise) = `www` today.
    - **Application/public URL constants** (used by auth redirects/callbacks/cookies) may be intentionally apex.
  - As written, it reads like a contradiction; it needs an explicit distinction to prevent confusion.

---

### 5) Messaging export verify-mode naming vs implementation

- **Documents/code expectation mismatch**
  - The edge function type includes `verification_mode: "provided_manifest_json"`, implying a manifest-only upload/verify path exists.
  - The implementation maps `"provided_manifest_json"` to `"provided_package_json"` and uses `provided_manifest_json` as a fallback **package JSON** payload, not a manifest-only verification.
- **Evidence**
  - Verify-mode remap: [`supabase/functions/messaging-thread-export/index.ts`](E:/Files/.coparrent/supabase/functions/messaging-thread-export/index.ts) lines 1670–1673
  - Fallback assignment: same file lines 1983–1986
- **Why out of alignment**
  - **Naming drift / leftover mode**: a previous design likely supported a manifest-only path; current code supports package verification, but the mode name still exists.

---

## Recommended corrections (documentation-only)

1. **Sync README “Done and Verified” counts** to match `docs/project/CURRENT_STATUS.md` and update `Last Verified Build` metadata to the same verification pass date.
2. **Clarify captcha posture** in README: explicitly label “QA exception” vs “production default,” or remove the QA-disabled line if no longer applicable.
3. **Clarify canonical URL vs env URL distinction**: add a note (in `BRANDED_GOOGLE_AUTH_SETUP.md` and/or `DEPLOYMENT_AUTH_CONFIRMATION_CHECKLIST.md`) explaining whether apex is used only for env/constants while `www` remains the public canonical host until confirmed.
4. **Align messaging export verification terminology**: either implement a true manifest-only verify path or rename/remove `provided_manifest_json` from any public-facing docs/UI/API expectations.

