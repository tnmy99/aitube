# AItube

A hand-built library of the best AI education on YouTube: university courses, learning paths,
talks and paper explainers, with a written reason for every video.

Live: **https://tnmy99.github.io/aitube/**

No accounts, no tracking, no algorithmic feed. The whole site is static; search, recommendations
and your saved lists run in your browser.

---

## What is in the library

| | |
|---|---|
| Videos | **9,218** |
| Channels | **95** (6 S-tier, 49 A, 39 B, 1 C) |
| Full courses | **39** (Stanford, MIT, Berkeley, CMU, NYU, Cornell, Caltech, Harvard, DeepMind/UCL, fast.ai, Hugging Face) |
| Learning paths | **8** ordered routes (Zero to GPT, How LLMs work, Maths for ML, Landmark papers, Post-training, AI safety, Big minds, Build a reasoning model) |
| Talks | **143** recommended over years of Hacker News threads |
| Hand-picked videos | **80** with a written reason |
| Topics | **20** |
| Embedding-blocked | **236** listed as “YouTube only” (their owners disable playback elsewhere) |
| With creator chapters | **1,061** |

## How a video gets in

Only four routes, and every one is a person's decision:

1. **A course.** 39 playlists are imported lecture by lecture, in order. Course videos are exempt
   from the title filter because the course itself is the selection.
2. **A hand-written pick.** 80 videos carry a sentence explaining why they are here.
3. **A Hacker News classic.** 143 talks and lectures that practitioners kept recommending, collected
   from the HackerTube dataset, each with the thread's reason.
4. **A channel selection.** For the other channels, only their AI-related uploads qualify — see below.

Nothing is auto-ingested wholesale. A channel is admitted first; only then do its uploads compete
for a place.

## Channels: why these 95

Every channel carries a tier and a written reason.

- **S — masterpieces (6):** Andrej Karpathy, 3Blue1Brown, Jeremy Howard (fast.ai), Welch Labs,
  StatQuest, Umar Jamil. If you only watched these, you would still learn the field.
- **A — excellent (49):** university courses, leading researchers and the best explainers
  (MIT OCW, Stanford Online, Caltech CS156, DeepMind, Anthropic, Hugging Face, Yannic Kilcher,
  Nathan Lambert, AI Coffee Break, Sebastian Raschka, Neel Nanda, …).
- **B — very good (39):** strong specialist channels and conference archives (AI Engineer,
  IBM Technology, Latent Space, Cognitive Revolution, Computerphile, …).
- **C — worth following (1):** Google for Developers, kept only for its Machine Learning Recipes
  series and ML engineering talks.

Channels were dropped when they were not about teaching AI: news (Julia McCoy), futurism
(David Shapiro), tool demos (David Ondrej, Tonbi), general dev commentary (ThePrimeTime, Theo,
Fireship), corporate marketing (Google for Developers’ non-ML output), or when they had almost no
AI content at all (No Boilerplate, LaurieWired, DeepSeek).

## The filters

A channel's whole upload history is never trusted blindly. Four filters run in
`tools/aifilter.py`:

- **AI topic** (`is_ai_title`): a broad ML/AI vocabulary — architectures, training, inference,
  evaluation, agents, safety, the maths that underpins them. Written to catch real AI videos whose
  titles never say “AI”, and to reject the classics (“Parseval’s Theorem” is not “eval”,
  “Whispering” is not “Whisper”).
- **Noise** (`is_noise`): uploads about the channel rather than the subject — news, vlogs, AMAs,
  reactions, sponsorships, trailers, hiring pitches, “day in the life”.
- **Shorts** (`is_short`): under 70 seconds, or tagged `#shorts`.
- **Per-channel exclusions**: regexes for channels that need them (e.g. a show-name suffix that
  contains the word “AI”, or a channel that publishes mostly non-English uploads).

Channels whose entire output is AI/ML teaching (65 of them) are **trusted by policy**: their
uploads skip the topic filter and go straight to the cap. Channels that mix AI with other subjects
(commentary, general dev, maths) are **filtered**: every upload must pass the topic filter.

**Caps.** Trusted channels contribute up to 200 videos, mixed channels up to 80, ranked by views.
Education channels are effectively unlimited at their real size; the cap exists to stop a
1,400-talk conference archive from drowning everything else.

## The audit that produced this catalogue

The first public build had 18,516 videos, because every channel had been ingested whole. That was
both too much (non-AI uploads leaked in) and too little (good lectures were cut by the cap).

The catalogue was then audited end to end:

| Bucket | Videos |
|---|---|
| Dropped with their channels | 3,666 (17 channels, of which 3 were later reinstated) |
| Beyond the per-channel cap | 10,171 → cut to a level that keeps whole curricula |
| News/vlog/AMA noise | 82 |
| Off-topic titles | 15 (checked by hand: Lex Fridman’s comedy episodes) |

## Learning paths

Paths are ordered by a person, not by an algorithm: intuition first, then derivation, then code.
“Zero to GPT” runs 3Blue1Brown’s neural-network series into Karpathy’s makemore and GPT builds.
“Landmark papers” pairs each paper with the best explainer of it.

## Tech

- Static site: plain HTML, CSS and ES modules. No framework, no build step for the UI.
- One JSON catalogue (~1.6 MB, ~500 KB gzipped) built by Python.
- Search: inverted index, prefix matching, AI shorthand synonyms (`rl`, `llm`, `moe`, `rag`, …),
  built lazily in the browser (34 ms for 9,218 videos).
- Recommendations: a local profile from likes, watch later, watched history and chosen topics,
  with IDF-weighted title words and a per-channel diversity cap. Every recommendation states why.
- State: `localStorage` only, exportable as JSON. Nothing leaves the browser except the YouTube
  embed.
- Content-Security-Policy with a hash for the single inline script, `frame-src` limited to YouTube,
  no third-party scripts, no fonts loaded from a CDN.

## Repository layout

    site/            the deployable site (HTML, CSS, ES modules, fonts, built catalogue)
    tools/           the data pipeline
      fetch_channels.py    yt-dlp per channel and playlist (no API key)
      fetch_videos.py      metadata, creator chapters, bot-wall detection
      check_embeds.py      oEmbed check for embedding-disabled videos
      aifilter.py          AI-topic and noise classifiers
      topics.py            topic taxonomy
      build_catalog.py     builds site/data/catalog.json, fails on broken references
      csp_hash.py          keeps the CSP hash in sync
      serve.py             local server
      export_public.sh     builds dist/ (the deployable copy)
    data/            inputs: channels, picks, paths, Hacker News classics, paper explainers
    tests/           49 Python + 20 JavaScript tests
    dist/            export; this is what gets deployed

## Building and running

    python3 tools/serve.py        # http://127.0.0.1:8765/
    tools/check.sh                # ruff, eslint (+1000-line cap), CSP hash, JS and Python tests
    python3 tools/build_catalog.py --strict
    tools/export_public.sh        # -> dist/, refuses if personal data appears

Refreshing the data (needs `yt-dlp`):

    python3 tools/fetch_channels.py
    python3 tools/fetch_videos.py --from-file ids.txt --refresh-missing chapters
    python3 tools/check_embeds.py
    python3 tools/build_catalog.py --strict

## Limits

- 236 videos cannot be embedded (their owners disabled it). They open on YouTube and still count
  toward course progress.
- Videos disappear from YouTube; the build drops anything the fetcher records as removed.
- Chapter markers are the creators' own; videos without them show none.
- The catalogue is a snapshot: new uploads appear after a rebuild, not immediately.

## Credits

- Talks and their Hacker News notes come from [HackerTube](https://hackertube.org) (ODC-By 1.0),
  derived from the open-index/hacker-news dataset.
- Video metadata and thumbnails belong to YouTube and to the creators; AItube only links and embeds.
- Inter by Rasmus Andersson (SIL Open Font License). iA Writer Mono for numbers.
- Curation, structure and site: tnmy (X: [@tnmy099](https://x.com/tnmy099)).
