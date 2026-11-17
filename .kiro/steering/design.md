---
inclusion: fileMatch
fileMatchPattern: "apps/mobile/**/*.tsx"
---

# UI design rules

Follow the design contract for every client screen and component:

#[[file:docs/design-contract.md]]

The rules people break most often:
- Dark theme only. One mint primary action per screen; no gradients on controls.
- Freshness stages are the only colourful system. Always show colour, icon and text together, never colour alone.
- Spooky effects must mean something: follow the "Costume layer" table. A new effect needs a meaning, a still frame for reduced motion (`useMotionAllowed()`), and the same fact in words.
- The decorative `font-display` face (Mountains of Christmas) is for the wordmark and the graveyard only. Page titles and card titles use `font-heading` (Bricolage Grotesque); body text uses the system font.
- Purple is a surface tint only, never a control or brand colour.
- Halloween illustrations (`components/halloween/art.tsx`) are decorative only and never stand for food or a control. `Pumpkin` means Haunting, `Flame` means expiring; don't swap them.
- At most one line of supporting text per row or card; explanations go in the item sheet.
- Touch targets are at least 44 px (`h-11`). Every control has an accessible label and role.
- Use `components/common/filter-chip.tsx` for chips and `responsive-sheet.tsx` for sheets.
