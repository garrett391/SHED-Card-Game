# Story / cinematic art

Full-screen scene images for the between-level cinematics defined in
src/campaign/story.ts.

Formats: PNG, or animated GIF/WebP (rendered by expo-image — a GIF is a
drop-in: require it exactly like a PNG, no code change).

Sizing: portrait or square works best; scenes render with contentFit
"contain" on a dark background, so any aspect ratio is safe. Keep files
reasonably sized (< ~2 MB each) — they ship in the app bundle.

Current files (wired in story.ts):

    schism-justin.png        Justin's Schism, scene 2
    greg-computer-lord.png   Super Tens, scene 1
    chaos-twins-card.png     Chaos Shed, scene 1

Wanted (scenes exist as caption-only title cards until art lands):

    Origin trilogy (jake-classic): meeting Jake / spreading the gospel /
      harmony throughout the land — the Ancient Learners' Deck art fits
      the first scene.
    nina (the-69), trevor (ofcom-standard), backpacker (backpackers-codex).

To wire new art: add the file here, then set the scene's `image:` in
src/campaign/story.ts to require('../../assets/story/<file>').
