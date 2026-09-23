# Desktop Buddy

A calm desktop companion for Windows. A small animated character lives in your
tray, reminds you to drink water, eat lunch, and step away from the screen, and
keeps time for focus sessions - without ever nagging you.

Built to the Phase 1 (MVP) scope of `desktop-buddy-antigravity-prompt.md`.

## Requirements

- Windows 10/11
- Node.js 20+

## Install and run

```bash
npm install
npm run dev
```

`npm install` must be run on the target machine: `better-sqlite3` is a native
module and is rebuilt for Electron by the `postinstall` script.

## Build and package

```bash
npm run typecheck
npm run build
npm run package:win
```

The NSIS installer is written to `dist/`.

## How it is put together

```
src/main        Electron main process: windows, tray, scheduling, data
src/main/core.ts  BuddyCore - the orchestrator every feature reports to
src/preload     contextBridge API exposed to the renderer as window.buddy
src/renderer    React dashboard, reminder popup, quick-add window
src/shared      Types, copy strings, and clip lookup shared by both sides
assets/videos   The character clips (one per buddy state)
assets/tray     Tray icons
```

The main process owns all state. Once a second it recomputes a
`DashboardSnapshot` and pushes it to every open window, so the dashboard, the
popup, and the tray can never disagree about what the buddy is doing.

### Precedence and the don't-nag rules

Every feature proposes a state; `CurrentStateService` picks the winner using a
single precedence list (celebration > reset > important reminder > active-time
warning > session boundary > normal > gentle > ambient). Interruption policy
lives in `NotificationService`: one popup per reminder, a two-minute cooldown,
gentle reminders combined, Focus Mode and Quiet Hours absolute, and nothing is
ever replayed as a backlog. Skip means skipped - the occurrence does not return.

### Data

- Reminders, history, and session state: SQLite (WAL) at
  `%APPDATA%/Desktop Buddy/desktop-buddy.db`
- Settings: `electron-store` (`desktop-buddy-settings.json`)

Times are stored as local time plus an IANA timezone, and next-trigger stamps
are recomputed on launch, on wake, and when the system timezone changes.

## Keyboard

- `Ctrl+Shift+B` - Remember This (quick add)
- `Esc` - dismiss the popup or the quick-add window

## Known gaps in this build

- There are seven clips, so the `warning` and `reminder` states fall back to the
  `idle` clip (the UI marks it as a stand-in).
- The supplied clips are opaque `yuv420p` VP9 with a solid black background and
  mixed resolutions (720p and 1080p), so the character shows inside a rectangle
  rather than floating transparently. See "Clips" below.
- `npm install` could not be run in the authoring sandbox (no network), so the
  app has not been executed end to end. Typecheck and run it locally first.

## Clips

Drop replacements into `assets/videos/` using the existing names. For a
borderless character, export VP9 WebM with a real alpha channel:

```bash
ffmpeg -i in.mov -c:v libvpx-vp9 -pix_fmt yuva420p -b:v 0 -crf 32 -row-mt 1 -an out.webm
```

Keep every clip the same resolution and make the first and last frame match so
the loop is seamless.
