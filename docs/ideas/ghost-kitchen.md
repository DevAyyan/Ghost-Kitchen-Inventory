# Ghost Kitchen

## Problem Statement
How might we get a household to eat the food it already paid for, without asking them to do a chore every time they shop?

## Recommended Direction
**A + B.** Make the daily nudge the product (A) and make getting food into the app nearly free (B).
- **A: "Cook this tonight".** An opt-in daily notification that names what is about to turn, only on days something is at risk, plus one dinner idea on the fridge screen.
- **B: Photo of an item.** One close-up photo replaces typing for things with no receipt. Gemini names it and reads the printed date when legible. (A photo of the whole fridge was dropped: it misses what is hidden and gives no dates.)

The fridge illustration and the ledger stay, but they serve those two things.

## Key Assumptions to Validate
- [ ] People keep adding food for more than a month. Test: 3 to 5 households, two weeks, count who is still adding in week 3.
- [ ] A cautious, guessed expiry date is trusted enough to act on. Test: ask after each week whether a wrong date ever made them ignore the app.
- [ ] A notification changes behaviour. Test: of items named in a reminder, how many were used before spoiling versus items not named.
- [ ] Item photos are accurate enough to be faster than typing. Test: time and corrections per photo, and how often the printed date is read correctly.

## MVP Scope
In: item photo, receipt scan, optional expiry checking, daily reminder, "Cook this tonight", ledger, meal plan and shopping list, shared households, learning loop, sniff test, weekly digest.
Out: see below.

## Not Doing (and Why)
- Barcode scanning — real value, but a separate input path. Revisit if the test shows item photos and receipts are not enough.
- Accounts and a hosted service — a different project with a different cost model. This stays a household server.
- More fridge visuals — no effort here until week-3 retention is known.

## Open Questions
- How often is the printed date read correctly from a pack photo?
- Is half the shelf life the right caution for photographed items with no printed date?
- What is the free-tier Gemini budget for a household of four over a month?
