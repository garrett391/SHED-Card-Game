# Character portraits

One PNG per character. Spec:
- Transparent background
- Square, 512x512 recommended (rendered small — 30px avatars and up)
- Consistent art style across the whole cast (they appear side by side)

Expected filenames (match character ids in src/campaign/characters.ts):

    jake.png  justin.png  greg.png
    chaos-twin-a.png  chaos-twin-b.png
    nina.png  trevor.png  backpacker.png

To wire one in, set its entry in src/campaign/characters.ts:

    portrait: require('../../assets/characters/greg.png'),

Everything falls back to the character's emoji while portrait is null, so
art can land one character at a time.