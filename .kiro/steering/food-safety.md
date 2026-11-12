# Food-safety rules

Wrong advice here can make someone ill. These rules are deliberate, so don't weaken them to make a feature easier.

## Freshness stages (`apps/mobile/lib/domain/expiry.ts`, `stageOf`)
- **fresh:** more than half of its shelf life left.
- **aging:** a quarter to half left.
- **expiring:** 2 days or less, or a quarter or less of its shelf life.
- **rotting:** up to 3 days past its date.
- **spoiled:** more than 3 days past, or any high-risk food past its date.
- **Haunting** is a filter, not a stage: expiring + rotting + spoiled.

## Floors that AI output can never override
- Meat, fish, eggs, dairy and leftovers are always high risk (`ALWAYS_HIGH_RISK` in `apps/api/src/products.ts`).
- High-risk food is never stored in the pantry (`sanitizeProduct`).
- Spoiled food, and rotting high-risk food, is never used in a recipe (`isCookable`). The client doesn't send it to the server either.
- Diet filters fail closed: if an ingredient can't be checked, the recipe is hidden, not shown.
- Shelf-life estimates are conservative (USDA FoodKeeper style). An estimated date is labelled as an estimate until the user confirms it.

## Wording
- Advice is guidance, not a guarantee. Keep the "always check the package and the food itself" note where dates are shown.
- Never tell the user that food past its date is safe.

## When changing any of this
Update the tests in `apps/api/test` (and the stage key in `components/fridge/stage-key.tsx`) in the same change.
