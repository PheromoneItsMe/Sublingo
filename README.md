# SubLingo

Learn English from the things you'd watch anyway.

SubLingo is a browser extension that turns any video with subtitles into a language lesson without breaking the flow of watching. You get English subtitles you can click word by word, a translation underneath, and a quiet system that remembers what you're learning. There are no streaks, no hearts and no cartoon owl. You watch the show, and the extension handles the rest.

> The interface is in Russian for now, since that's who it was built for. Translation works into 20+ languages and can be switched in the settings.

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

**Playback built around listening.** Jump between lines with `A` / `S` / `D`. Turn on auto-pause after every line, loop one line, or slow down just the speech while the pauses stay at normal speed. There's also an optional karaoke mode that highlights the word being spoken right now. It's exact on YouTube auto-captions and estimated elsewhere.

**Stays out of the way.** The line buttons only appear when you hover the subtitle text. When your mouse goes down to the seek bar, the subtitles lift above it. Scroll the wheel over a subtitle to flip between lines.

**Remembers what you save.** Every saved word keeps the sentence it came from and a link back to the exact moment in the video. Reviews use spaced repetition (an SM-2 variant) with recall, fill-the-gap, listening and reverse cards. Export goes to Anki, CSV or JSON.

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
| `Q` | auto-pause after each line |
| `R` | loop current line |
| `Z` | slow down speech |
| `H` | highlight the spoken word (experimental) |
| `E` | show / hide translation |
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

## Privacy

There's no account, server or analytics. Your words, phrases and settings live in your browser's extension storage. You can back them up to a JSON file from the settings page. The only things that leave your machine are the words and sentences you ask to translate, define or explain.

## Known rough edges

- Streaming sites change their players from time to time. If subtitles stop loading on a site, the fix is usually a few lines in `page/`.
- Word highlighting is estimated wherever the subtitles don't carry per-word timing.
- The free translation endpoint can rate-limit you if you hammer it.

---

Made by **pheromone**. Released under the [MIT License](LICENSE).
