# Using Claude with your To-Do Matrix

Your to-do list is a plain web endpoint (the Apps Script web app) backed by a
Google Sheet, and your **Google Calendar is already connected to Claude**. That
gives you two hands-free paths in addition to the app's own dictation.

## 1. Create calendar events through Claude (no app needed)
Claude has your Google Calendar connected, so you can just say:

> "Make a calendar event tomorrow 3pm for 'call the venue', 45 minutes."

Claude creates it directly on your Google Calendar. (The app's **📅** button does
the same thing from the task itself — you have both.)

## 2. Add / change to-dos by talking to Claude
In any Claude session that can make web requests, give Claude your two secrets
once (best: put them in a **Claude Project's custom instructions** so every chat
in that project knows them):

```
My to-do API URL: https://script.google.com/macros/s/XXXX/exec
My to-do password: <your SECRET>

To add a task, POST this JSON (as text/plain) to that URL:
{ "action":"add", "pass":"<password>",
  "task": { "title":"<the task>", "quadrant":"<us|uc|ls|lc>", "notes":"", "due":"" } }

Quadrants: us = urgent+simple, uc = urgent+complex,
ls = long-term+simple, lc = long-term+complex.
To complete a task: { "action":"update","pass":"<password>","id":"<id>","fields":{"done":true} }
To delete: { "action":"delete","pass":"<password>","id":"<id>" }
To see current tasks: { "action":"list","pass":"<password>" }
```

Then you can say things like:

> "Add 'renew the liquor license' to my urgent-complex list."
> "Mark the venue call done."
> "What's on my urgent list right now?"

Claude reads/writes the same Google Sheet the app uses, so everything stays in
sync automatically.

### Quick test from a terminal
```bash
curl -L -X POST "$URL" -H 'Content-Type: text/plain' \
  -d '{"action":"add","pass":"YOUR_PASSWORD","task":{"title":"Test from CLI","quadrant":"us"}}'
```

> **Note on the iPhone Claude app:** the consumer app can create calendar events
> directly (path #1) because Calendar is a built-in connector, but it can't make
> arbitrary web POSTs, so for *adding tasks* on the phone, use the app's
> dictation (tap the keyboard mic) — that's the one-tap "quickly add without
> opening a heavy app" flow. Web/desktop Claude sessions with a web tool can do
> the full add/modify/list above.
