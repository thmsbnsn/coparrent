# CoParrent Codex Rules
- Limit the amount of editors that stay open. Dont overwhelm the pc and cause performance issues with the number of extenstion windows staying open.
- Keep browser-based tooling lean. Reuse one browser session when needed, do not leave tool-opened browser windows or extension webviews running after verification, and avoid duplicate preview windows for the same task.
## Primary architecture rule

Use `activeFamilyId` on the client and explicit `family_id` on the server as the only valid scope for family-scoped operations.

## System invariants (must never be broken)

- All operations must be scoped by activeFamilyId / family_id
- Never infer relationships across families
- Server-side enforcement is always the source of truth (RLS, edge functions)
- Client state is advisory only

## Family scope enforcement

- All reads, writes, notifications, and AI actions must include explicit family scope
- No operation should proceed without a valid activeFamilyId / family_id
- Multi-family users must always operate within a selected family context

## Trust boundaries

- The client must never be trusted for authorization, role, or plan decisions
- All permission, role, and plan checks must be enforced server-side
- The client may reflect state but must never define it

## Failure handling rules

- If family scope is missing or ambiguous, the operation must fail (never guess or fallback)
- No silent failures — errors must be surfaced clearly in logs or UI
- Never auto-correct or infer missing identifiers

## Do not reintroduce

- `co_parent_id` recipient inference
- implicit profile-pair scoping
- cross-family fallback logic
- ambiguous family resolution

## AI behavior constraints

- Do not introduce new patterns that bypass existing architecture rules
- Do not refactor unrelated systems unless explicitly required
- Prefer minimal, surgical changes over broad rewrites
- Maintain consistency with existing patterns and naming conventions

## Change discipline

- Touch only files needed for the ticket
- Preserve existing RLS and premium gating unless the ticket explicitly changes them
- Add targeted tests for each scoped migration
- Run:
  - targeted vitest
  - eslint on touched files
  - npm run build
  - npm run test -- --run
  - git diff --check on touched files

## Output format

1. Summary of code changes
2. Tests added
3. Verification results
4. Any unrelated pre-existing repo issues
