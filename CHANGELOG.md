# Changelog

## 1.11.1

New:
- **Pause before a line.** The video stops just before a line is spoken and shows it in advance. You read it first, then press Space or `D` to hear it. It can run before every line or only before hard ones (`P`).
- **Auto-pause on hard lines only.** Besides pausing after every line, auto-pause can stop only where a line has words you don't know yet (`Q` cycles off / every line / hard lines). Hard lines are marked in the line list.
- **Translation hidden until hover** (`T`), in the subtitles and in the line list.
- **Phrasal verbs and set expressions** (about 270, with Russian meanings) are underlined as one unit. Hover and click give the meaning of the whole expression, and each word can still be opened separately (`G`).
- **Video recap.** At the end of a video you get the words you're learning that came up, the words you looked up, and the expressions from the video. It's also in the ⋯ menu.
- **Quick appearance settings** in the ⋯ menu: subtitle size, translation size and background, remembered per site.
- **Collapsible control bar** at the top of the line list.

Improved:
- The ⋯ menu is easier to use. It doesn't close on the way from the button, stays still while you adjust sizes, and is never covered by the player.
- Faster redrawing of subtitles and the line list. Word forms, line parsing and expressions are now cached.
- Safer handling of data from websites, stricter limits on what pages can ask the extension to do, and cleanup of voice clips that are no longer used.
- Voice recording uses the modern audio API. After an extension update, old tabs quietly ask to be refreshed instead of throwing errors.

## 1.8
- Subtitles can be dragged anywhere over the video with the ✥ handle or by the line's background. The position is remembered separately for YouTube, Netflix and each site. Double-click ✥ or use "⋯ → Вернуть субтитры вниз" to reset.
- The stats page now shows proper line charts with axes, a grid and hover values.

## 1.7.1
- Synthetic voice setting: off, button only (the default), or automatic. With the voice off, review skips listening cards that have no real audio.
- When no voice is chosen, the most natural one available is used instead of the system default.

## 1.7
- Hover translation: a small tooltip above a word, with the full card on click.
- Saved words and phrases keep the real audio of the line and a still frame from the video. Review plays the actor's voice, and the Anki export becomes a ZIP with sound and images.
- New stats page: listening time, lines and words heard, lookups, words that have truly stuck, and words you hear often but don't study yet. No streaks or points.

## 1.6.3
- Phrase selection grows smoothly instead of jumping.
- Karaoke highlight steps aside while you're picking a phrase.
- Phrases that wrap onto a second line keep their spaces.

## 1.6
- Experimental karaoke mode (`H`): highlights the word being spoken.
- `Ctrl` + click phrases keep their selection, so you can release `Ctrl` and keep adding words.

## 1.5
- YouTube subtitles load even when captions are off in the player.
- Videos without English subtitles use YouTube's English auto-translation as the source text.
- Subtitles stay visible in fullscreen on embedded players.
- Slow-speech hotkey (`Z`).

## 1.4
- No more button bar under the subtitles: controls appear beside the line on hover, and the rest lives in a `⋯` menu.
- Subtitles lift above the player's seek bar when you reach for it.
- Mouse wheel over subtitles flips between lines.
- On-screen captions in ALL CAPS are filtered out of translations.

## 1.3
- Embedded players (Playerjs, JW Player, Video.js): subtitles are grabbed automatically, even when switched off.

## 1.2
- `Ctrl` + click to build a phrase from several words.

## 1.1
- Compact word card with a "More" button.
- Support for any HTML5 video player, including ones inside iframes.

## 1.0
- First version: dual subtitles on YouTube and Netflix, word card, saved words, spaced-repetition review, reading mode, local video player, Anki export.
