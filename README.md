# Worry Ledger

A place to park worries instead of carrying them.

You capture a worry in a few seconds, rate how heavy it feels, and set a date to
check back. When that date arrives, the tool asks what actually happened. That
is all it asks of you.

What builds up is your own evidence base, and it comes down to one number: how
many of the things you worried about never came true. Most people have never
counted. Counting turns out to be the point.

**[Open it here](https://evelinehansen.github.io/worry-ledger/)**

## What it does

- **Capture a worry** in seconds, with a weight for how heavy it feels right
  now.
- **Set a check-in date** for when you will know how it turned out.
- **Record what happened** when that date arrives.
- **See the tally** of how many worries came true, how many did not, and how the
  weight you gave them compares to how they landed.
- **Export and import** the whole ledger as a single JSON file.

## Running it

Open it at [the link above](https://evelinehansen.github.io/worry-ledger/).
There is nothing to install, no build step, and no account. It works offline
once loaded.

On an iPhone, open it in Safari and use Share, then Add to Home Screen. That
gives it its own icon and, importantly, stops Safari clearing your ledger after
a week of not opening it.

If you clone the repo instead, the scripts are ES modules, so serve the folder
over HTTP rather than opening `index.html` from the file system:

```
python3 -m http.server 8000
```

## Where your data lives

Everything is stored in your own browser, on your own device. There is no
server, no account, and no analytics. Nothing you type is sent anywhere, and the
page makes no network requests at all once it has loaded. Worries are about as
private as writing gets, and the simplest way to keep them private is for them
never to leave your device.

That also means nobody else is keeping a copy for you:

- **Browsers clear their own storage.** Safari in particular clears data for
  sites you have not opened in about a week. Adding it to your home screen
  prevents this; using it as an ordinary bookmarked page does not.
- **Export is the real backup.** The export is a single JSON file you can keep
  anywhere and import back later.
- **Browser storage is not private.** Anything stored this way can be read by
  other pages served from the same address, and by software running on your
  device. It is not encrypted. Do not keep passwords or anything sensitive in
  here.

## How it's built

Plain HTML, CSS, and JavaScript. No frameworks, no build step, and no packages
pulled in from anywhere else, so the files in this repo are the whole tool: what
you can read here is what runs in your browser. There is nothing to sign in to
and no API keys or hidden configuration.

## Credits

Idea and direction by Eveline, coding by Claude. Built for my own practice,
learning and use.

Personal project, shared as is.

