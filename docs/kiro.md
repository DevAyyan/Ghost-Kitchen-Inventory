# How we used Kiro

We built Ghost Kitchen with Kiro as the main developer and ourselves as reviewers. Everything below is in
the repository (`.kiro/` and `docs/`), so you can check it.

Our approach: **the AI writes the code, and rules written down in the repo decide what's allowed.**
The app gives food-safety advice, so a wrong answer could make someone ill. Most of our Kiro setup exists to
make the safe choice the default, in every session and every change.

## Kiro apps: IDE and CLI

We used the **Kiro IDE** to edit and review code. The steering rules and the four save hooks below run
there: saving a file typechecks it, runs the tests, or has Kiro review the change, so problems show up in
the editor as soon as they're made.

The long tasks ran in **Kiro CLI**, in sessions that went from a feature request to working,
tested, committed code. A typical task was "add live sync across devices": Kiro read the code, changed the
client and the server, wrote tests, ran a two-device browser test, and committed.

The CLI suited us because the work was mostly running things: Docker, the API tests, the Expo web export,
Playwright browser tests, `vercel dev`, and git. For example, when deployment failed with
`FUNCTION_INVOCATION_FAILED`, Kiro rebuilt the app the way Vercel does in a clean clone, unpacked the
built function, and ran it against a throwaway Postgres. That reproduced the exact `ERR_REQUIRE_ESM` crash
from the logs, and the fix was verified before it was pushed.

Both apps read the same `.kiro/` folder, so the rules were the same whichever one we used.

## Steering docs: the biggest difference

There are three steering files in `.kiro/steering`, each with a different job and a different inclusion mode.

**`food-safety.md` (always included).** The safety floors, with the file and function that enforces each one:
- Meat, fish, eggs, dairy and leftovers are always high risk (`ALWAYS_HIGH_RISK`).
- High-risk food is never stored in the pantry (`sanitizeProduct`).
- Spoiled food, and rotting high-risk food, never goes into a recipe (`isCookable`).
- Diet filters fail closed.
- Shelf-life estimates are conservative and labelled "est." until checked.
- The text never calls food past its date safe.

It opens with: *"These rules are deliberate, so don't weaken them to make a feature easier"*, and it ends with
*"Update the tests in `apps/api/test` in the same change."*

**`tech.md` (always included).** The hard constraints:
- Free resources only.
- The whole stack runs in 4 GB of RAM.
- Every feature works on web and Android from one codebase.
- The Gemini key never reaches the client.
- Exact dependency versions.
- Zod validation of every request and AI response.
- A timeout and a fallback on every external call.
- Bump the store version and add a migration when saved data changes shape.

**`design.md` (included when a `.tsx` file is involved).** It pulls in `docs/design-contract.md` with a
`#[[file:...]]` reference, so pixel-art and accessibility rules load only when UI is being written. Next to it,
`frontend-ui-engineering/SKILL.md` adds UI-quality practice for the same files.

**The strategy that made the biggest difference: name the enforcing code, not just the rule.** "Be careful
with food safety" did little. "High-risk food is never stored in the pantry (`sanitizeProduct`)" let Kiro
find the code, keep it, and test it. Examples from the build:
- **A request to make the badges match their descriptions.** Kiro changed the two badge rules and added
  tests for every badge, including "throwing food out never earns a saving badge".
- **Choosing a host.** Kiro weighed options against the free-only and 4 GB limits without being reminded.
- **Planning OCR on Vercel.** Kiro kept a timeout and a fallback (in-process `tesseract.js`) so receipt
  scanning still works if the OCR service is down.
- **Gemini's structured output.** It rejects `minItems`/`maxItems`. Kiro strips them from the generated
  schema, as `tech.md` describes, and leaves Zod to enforce the limits.

Splitting by inclusion mode kept every session's context small. The safety and stack rules are always
there; design rules only load for UI work.

## Agent hooks: automatic checks on every save

There are four hooks in `.kiro/hooks`:

| Hook | Trigger | What it does |
|---|---|---|
| API: typecheck and test on save | Save of `apps/api/src` or `apps/api/test` `*.ts` | Runs `tsc --noEmit` and the Vitest suite |
| Mobile: typecheck on save | Save of `apps/mobile/(app\|components\|lib)` `*.ts(x)` | Runs `tsc --noEmit` on the Expo app |
| Demo data: cross-check on save | Save of `apps/mobile/lib/demo/*` | Reruns the tests that keep offline demo mode in step with the server's ingredient matching and safety floor |
| **Food-safety review** | Save of the expiry, storage, surplus, voice, planner, product, recipe or demo-data logic | An **agent hook**: Kiro reviews the change against `food-safety.md` |

The food-safety review hook is the one we're proudest of. Tests catch a broken rule. This hook catches a
weaker one that still passes, such as:
- a threshold moved the wrong way,
- a surplus offer that could include high-risk food,
- wording that implies food past its date is safe,
- voice logging applying an action without the user confirming it.

It also checks that the tests and the on-screen stage key still match the rules. The other hooks give
quick feedback on every save, so type errors and broken tests show up the moment they're introduced.

## Spec-driven development

We didn't use Kiro's Spec feature (`.kiro/specs`). We started from two documents of our own, written before
any code, and Kiro built from them:
- **`docs/SRS.md`:** requirements, freshness stages, user classes and an MVP scope.
- **`docs/SDS.md`:** architecture, data model, services and the safety floors.

We later had Kiro review the code against the requirements document to find gaps. That review turned up a
missing duplicate-item warning, a missing data export and a missing budget, which became a task list Kiro
then implemented.

Compared with vibe coding, writing the requirements first meant the safety floors and constraints existed
before any feature did. Features fit around them instead of the rules being added afterwards. The design
document also records where the code went its own way ("where this document and the code disagree, the
code is right"), so it didn't become a stale source of mistakes.

## What we didn't use, and why

- **Custom agents:** none. The always-included steering plus the food-safety hook did the job a dedicated
  "safety reviewer" agent would have.
- **MCP:** none. The services we needed (Gemini, TheMealDB, Frankfurter, Open Food Facts, Clerk) are called
  by the app's own server, and Kiro worked with them through the code, the tests and the command line.
- **Powers:** none.
- **Property-based testing:** none. The safety rules are covered by example-based tests in Vitest (143 API
  tests), Playwright browser tests (including a two-device sync test) and the review hook. The freshness
  rules are a clear next candidate for PBT. For example: "for any shelf life and any day, high-risk food
  past its date is always spoiled", and "learned shelf lives never get longer and never drop below half".

## What we'd tell another team

1. Write the rules that must never break into always-included steering, and name the code that enforces each one.
2. Use a command hook for anything a test can check, and an agent hook for anything that needs judgement.
3. Let Kiro reproduce a production failure locally before it fixes anything. Every deployment fix we
   shipped was reproduced first.
