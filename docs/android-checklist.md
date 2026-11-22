# Android check before a release

The browser tests (`e2e/`) cover the web build. These need a real phone, because the emulator can't show
some of them (sharpness, battery, sound, haptics). Build with `cd apps/mobile && npx eas-cli build -p android --profile preview`,
install the APK, load the sample fridge (Settings → Data → Load sample data) and go through the list.

| Check | What good looks like |
|---|---|
| Kitchen scene | Fridge and pantry doors rest slightly open with the green light flickering; a ghost peeks out now and then; slime drips; red eyes blink in the pantry crack |
| Sharpness | Sprites look blocky, not blurred. Android scales images smoothly, so some softness is expected; note how much at your phone's size |
| Opening a door | Frames play, the zoom covers the whole screen including the status and nav bars, the shelves appear, the light stays on through the swing |
| Back button | In an open compartment it closes the door (it doesn't leave the app or the tab) |
| Poking a ghost | Opens the most urgent item. With TalkBack on, the door's actions menu has "Show the most urgent food" |
| Fonts | Body text is VT323 and titles Pixelify Sans, bold text included (not the system font) |
| Larger text | Settings → Larger text makes every text a step bigger without clipping |
| Sounds | Spooky 8-bit sounds on door open and close, burying and the ghost; silent when the phone is on silent; off with "Sounds and vibration" |
| Haptics | A light tap on doors, a heavier one on burying |
| Notification | The digest arrives with the white pixel fridge-and-ghost icon, tinted by the system |
| Food photos | Shelf tiles show a soft 16-cell mosaic; the item sheet shows the full photo |
| Battery and memory | Leave the fridge screen open for 10 minutes: the phone shouldn't warm up, and scrolling stays smooth |
| Reduced motion | With the system's "Remove animations" on, everything holds still and doors open instantly |
