# Story / cinematic art

Full-screen scene images for the between-level cinematics defined in
src/campaign/story.ts.

Formats: PNG, or animated GIF/WebP (rendered by expo-image — a GIF is a
drop-in: require it exactly like a PNG, no code change).

Sizing: portrait or square works best; scenes render with contentFit
"contain" on a dark background, so any aspect ratio is safe. Keep files
reasonably sized (< ~2 MB each) — they ship in the app bundle.

story.ts is the source of truth for which file each scene uses.

Wanted (scenes exist as caption-only title cards until art lands):

    jake-classic, scene 7: Jake teaching by the campfire, "it's all up
      here" (optional; works as a title card).
    jake-classic, scene 8: the duel, to replace intro6.png (optional).

To wire new art: add the file here, then set the scene's `image:` in
src/campaign/story.ts to require('../../assets/story/<file>').
