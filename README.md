# SubLingo

Learn English from the things you'd watch anyway.

SubLingo is a browser extension that turns any video with subtitles into a language lesson without breaking the flow of watching. You get English subtitles you can click word by word, a translation underneath, and a quiet system that remembers what you're learning. There are no streaks, no hearts and no cartoon owl. You watch the show, and the extension handles the rest.

> The interface is in Russian for now, since that's who it was built for. Translation works into 20+ languages and can be switched in the settings.

---

## What's new in 1.11.1

- **Pause before a line.** The video stops right before a line is spoken and shows it ahead of time. You read the English first, then hear it. It's great for videos in your own language with English subtitles.
- **Auto-pause on hard lines only.** It stops only where a line has words you don't know yet, so easy lines keep flowing.
- **Translation hidden until hover.** You get a moment to understand the line on your own first.
- **Phrasal verbs and set expressions** like *give up*, *figure it out* and *by the way* are recognized as one unit, with their meaning in Russian.
- **Video recap** at the end: the words you're learning that came up, what you looked up, and the expressions from the video.
- **Quick appearance settings** right in the ⋯ menu: text size, translation size and background, remembered per site.
- **A tidier line list.** The control bar on top folds away when you don't need it.

It's also faster and sturdier under the hood. Subtitles and the line list redraw with much less work, data coming from websites is handled more strictly, unused voice clips get cleaned up, and an extension update no longer leaves errors in open tabs.

The full list is in [CHANGELOG.md](CHANGELOG.md).

---

## What it does

**Dual subtitles that you can interact with.** English sits on top and the translation sits below. Click any word to get a short translation with a "Know / Learning" switch, and expand it when you want definitions, examples and dictionary links. Hold `Ctrl` and click the first and last word of a phrase, release, and you get the whole phrase translated. Release `Ctrl` by accident? Hold it again and keep adding words.

**Works where you watch.**
- YouTube, including auto-generated captions. Videos without English subtitles get YouTube's own English auto-translation, with the original subtitles used as the translation.
- Netflix.
- Most embedded HTML5 players on other sites (Playerjs, JW Player, Video.js, plain `<video>` with tracks). If the player has subtitles turned off, SubLingo quietly flips them on, grabs them and switches them back.
- Your own video files with `.srt` / `.vtt`.
- Any web page: `Alt` + click a word, or select text and hit "Translate".

**Colors that mean something.** Words you're learning are orange, the next most useful words for your level are yellow, new words are blue, and rare words fade out. A two-minute level check in the settings decides what counts as "known", so you don't spend a week marking *the* and *because*.

**Playback built around listening.** Jump between lines with `A` / `S` / `D`. Auto-pause can stop after every line or only after the hard ones, the lines with a couple of words you don't know yet, so easy lines keep flowing. There's also a pause *before* each line: the video stops just before a line is spoken, you read the English first, then hear it. This is great for videos in your own language with English subtitles. Loop one line, or slow down just the speech while the pauses stay at normal speed.

**Try first, then peek.** The translation can stay blurred until you hover over it, so you get a moment to understand the line on your own.

**Phrases, not just words.** Phrasal verbs and set expressions like *give up*, *figure it out* or *by the way* get a dotted underline. Hover or click one and you get the meaning of the whole thing instead of each word on its own. You can still open each word separately from the card.

**A short recap at the end.** When a video ends, a small card lists the words you're learning that came up, the words you looked up along the way, and the expressions from the video. No scores or streaks. There's also an optional karaoke mode that highlights the word being spoken right now. It's exact on YouTube auto-captions and estimated elsewhere.

**Hover to peek.** Rest the mouse on a word for half a second and a tiny translation appears above it. Click only when you want the full card.

**Stays out of the way, or wherever you want it.** Drag the subtitles anywhere over the video, even right into the middle where your eyes already are. The spot is remembered per site, and so are text size, translation size and background, which you can tweak from the ⋯ menu without opening the settings. The line buttons only appear when you hover the subtitle text. When your mouse goes down to the seek bar, the subtitles lift above it. Scroll the wheel over a subtitle to flip between lines.

**Remembers what you save, in the actor's own voice.** Every saved word or phrase keeps the sentence it came from, a link back to the exact moment, and, where the browser allows it, the actual audio of that line plus a still frame. Reviews play the real voice instead of a robot, and the Anki export ships the clips and frames too. DRM-protected streams like Netflix are the exception. Reviews use spaced repetition (an SM-2 variant) with recall, fill-the-gap, listening and reverse cards. Export goes to Anki, CSV or JSON.

**Reading mode.** Paste an article, open a `.txt` / `.srt`, or send a page there from the right-click menu. It shows the same clickable words, per-sentence translation and read-aloud, plus how much of the text you already understand.

---

## Install

The extension isn't in the Chrome Web Store yet, so you load it unpacked:

1. Clone or download this repository.
2. Open `chrome://extensions` (or `brave://extensions`, `edge://extensions`).
3. Turn on **Developer mode**.
4. Click **Load unpacked** and pick the folder with `manifest.json`.
5. Reload any open video tabs.

To update later, pull the changes, hit ⟳ on the extension card and reload the tab.

Works in Chromium-based browsers (Chrome, Brave, Edge, Opera, Vivaldi).

---

## Keyboard

| Key | Action |
|---|---|
| `A` / `S` / `D` | previous line / repeat / next line |
| `Q` | auto-pause: off → every line → hard lines only |
| `R` | loop current line |
| `Z` | slow down speech |
| `H` | highlight the spoken word (experimental) |
| `E` | show / hide translation |
| `P` | pause before each line: off → every line → hard lines only |
| `T` | keep the translation blurred until hover |
| `G` | underline phrasal verbs and expressions |
| `W` | save line as a phrase |
| `C` / `X` | copy line / read it aloud |
| `[` `]` `\` | slower / faster / normal speed |
| `Shift+[` / `Shift+]` | shift subtitles earlier / later |
| `V` / `B` | hide subtitles / toggle the line list |
| `Ctrl` + click | build a phrase from several words |
| `1` `2` `3` | in the word card: know / learning / ignore |

The keys also work with a Russian keyboard layout.

---

## Under the hood

Plain JavaScript, Manifest V3, with no build step and no dependencies.

```
background.js      service worker: translation, dictionary, storage, spaced repetition, context menu
common/            shared helpers, subtitle parsers, lemmatizer, word-frequency list, SRS
content/           subtitle engine (overlay, line list, hotkeys), word card, site adapters
page/              small scripts that run inside the page to reach the site's own player
pages/             popup, settings, saved words, review, reading mode, local video player
```

- Translations come from Google Translate's public endpoint, and English definitions from [dictionaryapi.dev](https://dictionaryapi.dev).
- Word levels use a frequency list built from [wordfreq](https://github.com/rspeer/wordfreq) (CC BY-SA 4.0).
- "Explain" uses your own API key and works with any OpenAI-compatible endpoint (or Anthropic). It's optional.

## Honest stats

There are no streaks, points or badges. The stats page shows what you actually did: minutes spent listening, lines and distinct words heard, how often you looked something up, and how many words have truly stuck. A word only counts as stuck once spaced repetition has pushed it three weeks out and you still remember it. Nothing gets marked as "known" behind your back. The vocabulary-level setting only drives the highlighting and never inflates these numbers. There's also a list of words you keep hearing but haven't started learning yet, which is usually the best place to pick the next ones.

## Privacy

There's no account, server or analytics. Your words, phrases, audio clips and settings live in your browser's extension storage. You can back them up to a JSON file from the settings page. The only things that leave your machine are the words and sentences you ask to translate, define or explain.

## Known rough edges

- Streaming sites change their players from time to time. If subtitles stop loading on a site, the fix is usually a few lines in `page/`.
- Word highlighting is estimated wherever the subtitles don't carry per-word timing.
- The free translation endpoint can rate-limit you if you hammer it.

---

Made by **pheromone**. Released under the [MIT License](LICENSE).
