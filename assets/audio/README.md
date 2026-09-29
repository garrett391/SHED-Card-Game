# Audio assets

Source: Kenney "Casino Audio" pack (https://kenney.nl/assets/casino-audio), CC0.

Keep `LICENSE.txt` from the pack alongside these files — CC0 doesn't require
attribution, but shipping the license makes provenance obvious.

## Why .m4a and not the pack's .ogg?

Two hard blockers, not preference:
1. Metro (this project's bundler) does not include `ogg` in its asset
   extensions, so `require('./x.ogg')` fails to bundle.
2. iOS (AVFoundation) and Safari cannot decode Ogg Vorbis at all.

## Converting

From the extracted `kenney_casino-audio/Audio/` directory, with ffmpeg installed
(https://ffmpeg.org — or `winget install ffmpeg` in Windows, `brew install ffmpeg` on Mac):

Basic conversion:

    for f in card-slide-1 card-slide-2 card-slide-3 card-slide-4 \
             card-slide-5 card-slide-6 card-slide-7 card-slide-8 \
             cards-pack-open-1 cards-pack-open-2 \
             card-fan-1 card-fan-2 \
             card-place-1 card-place-2 card-place-3 card-place-4 \
             card-shove-1 card-shove-2 card-shove-3 card-shove-4; do
      ffmpeg -i "$f.ogg" -c:a aac -b:a 96k "$f.m4a"
    done

Convert + clean (recommended — trims leading silence so taps feel instant,
matches loudness across files, de-clicks both ends):

    for f in card-slide-1 card-slide-2 card-slide-3 card-slide-4 \
             card-slide-5 card-slide-6 card-slide-7 card-slide-8 \
             cards-pack-open-1 cards-pack-open-2 \
             card-fan-1 card-fan-2 \
             card-place-1 card-place-2 card-place-3 card-place-4 \
             card-shove-1 card-shove-2 card-shove-3 card-shove-4; do
      ffmpeg -y -i "$f.ogg" -af "\
    silenceremove=start_periods=1:start_threshold=-45dB,\
    afade=t=in:d=0.005,\
    loudnorm=I=-20:TP=-2,\
    areverse,afade=t=in:d=0.03,areverse" \
        -ar 44100 -c:a aac -b:a 96k "$f.m4a"
    done

Filter chain, in order: strip leading silence down to the first sound above
-45 dB (removes tap latency) → 5 ms fade-in to de-click the new hard start →
loudness-normalize everything to the same perceived level (-20 LUFS, peaks
capped at -2 dB) → fade the last 30 ms (reverse, fade-in, reverse — fades the
tail without needing to know each file's duration). `-ar 44100` is needed
because loudnorm internally resamples to 192 kHz.

(Git Bash on Windows runs both loops as-is.)

Copy the 20 resulting .m4a files plus the pack's License.txt (rename to
LICENSE.txt) into this directory. Expected files:

    card-slide-1.m4a   card-slide-2.m4a   card-slide-3.m4a   card-slide-4.m4a
    card-slide-5.m4a   card-slide-6.m4a   card-slide-7.m4a   card-slide-8.m4a
    cards-pack-open-1.m4a   cards-pack-open-2.m4a
    card-fan-1.m4a   card-fan-2.m4a
    card-place-1.m4a   card-place-2.m4a   card-place-3.m4a   card-place-4.m4a
    card-shove-1.m4a   card-shove-2.m4a   card-shove-3.m4a   card-shove-4.m4a
    LICENSE.txt

## Page flicks (derived)

`page-flick-1..6.m4a` are made from the cleaned `card-slide-1..6.m4a` above.
The raw slides read as a cartoony swoosh when used as a page turn, so they're
cut down to a short, muffled flick. Run from this directory:

    for i in 1 2 3 4 5 6; do
      ffmpeg -y -i "card-slide-$i.m4a" -af "\
    silenceremove=start_periods=1:start_threshold=-35dB,\
    afade=t=in:d=0.01,\
    lowpass=f=3500,\
    atrim=end=0.25,\
    afade=t=out:st=0.1:d=0.15" \
        -ar 44100 -c:a aac -b:a 96k "page-flick-$i.m4a"
    done

Filter chain: skip the soft lead-in straight to the flick → 10 ms de-click
fade-in → low-pass at 3.5 kHz to take the bright plastic hiss off (paper, not
card stock) → hard cap at 250 ms → fade the last 150 ms so the tail dies fast.
Slides 7–8 and the pack-open sounds aren't used: each builds up for
200–250 ms before its peak, and that build-up is what makes them sound like
a swoosh.

## Mapping (see src/audio/sfx.ts)

| Sound      | Files            | Trigger                                   |
|------------|------------------|-------------------------------------------|
| pageTurn   | page-flick-1..6                        | Dialogue / cinematic advance (random)      |
| shuffle    | card-fan-1..2                          | Dealing a new game (random variant)        |
| cardPlace  | card-place-1..4                        | Any cards played, incl. bots (random)      |
| cardPickup | card-shove-1..4                        | Any pile pickup, incl. bots (random)       |