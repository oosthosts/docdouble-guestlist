# Eisenhower To-Do (Matrix)

A phone-friendly to-do app organized as an **Eisenhower priority matrix**, with
real cross-device sync (no manual syncing), dictation, drag-to-reorder, and
one-tap **Google Calendar** events.

- **Frontend:** a single static PWA (`todo/index.html`) served from GitHub Pages.
  Works on every iPhone / device, installs to the home screen, opens with one tap.
- **Backend:** a **Google Apps Script** web app that stores tasks in a **Google
  Sheet** (your data, in your Google account) and can create Google Calendar
  events.
- **Login:** one shared password, remembered per device.

The four quadrants (your axes: **urgency** × **complexity**):

| | Simple | Complex |
|---|---|---|
| **Urgent** | **Do First** (`us`) | **Block Time** (`uc`) |
| **Long-term** | **Quick Wins** (`ls`) | **Plan / Project** (`lc`) |

---

## One-time setup (~5 minutes)

### 1. Create the backend (Google Sheet + Script)
1. Make a new spreadsheet at <https://sheets.google.com> (e.g. "Eisenhower To-Do").
2. **Extensions → Apps Script.** Delete the starter code, paste in the contents
   of [`apps-script/Code.gs`](../apps-script/Code.gs).
3. In the `CONFIG` block at the top, set **`SECRET`** to a password of your choice.
   (Leave `CALENDAR_ID: 'primary'` to use your main Google Calendar.)
4. **Deploy → New deployment → Web app:**
   - Execute as: **Me**
   - Who has access: **Anyone** (the password protects it)
5. **Authorize** the permissions (Sheets + Calendar), then **copy the Web app URL**
   (ends in `/exec`).

### 2. Publish the frontend (GitHub Pages)
In the repo **Settings → Pages**, set the source to your default branch. Your app
will be at:

```
https://oosthosts.github.io/docdouble-guestlist/todo/
```

> Optional: paste your `/exec` URL into `DEFAULT_API_URL` near the top of
> `todo/index.html` so you only ever type the password.

### 3. Open it on your phone
Open the `/todo/` URL in Safari (iPhone) or Chrome, enter the **Web app URL** +
your **password** once, then **Share → Add to Home Screen**. Done — one tap from
then on, synced everywhere.

---

## Using it
- **Add:** type in the top box (tap the **mic** on your keyboard to dictate),
  pick a quadrant chip, hit **+**.
- **Reorder / re-prioritize:** drag tasks within a quadrant or **drag between
  quadrants**. On a phone, open a task (✎) and change its quadrant.
- **Complete / delete / edit:** tap the checkbox, or **✎** to edit/delete.
- **Calendar:** tap **📅** on a task → pick a time → it lands on your Google
  Calendar (and the task shows a "📅 on calendar" badge).
- **Offline:** the app opens instantly from cache and queues changes; they sync
  when you're back online (watch the dot by the title: green = synced).

## Add tasks by talking to Claude
Because the backend is a plain web endpoint and your Google Calendar is already
connected to Claude, you can also say things like *"add 'call the venue' to my
urgent-simple list"* — see [`CLAUDE-INTEGRATION.md`](../CLAUDE-INTEGRATION.md)
for the exact request shape Claude (or any automation) uses to add/modify tasks.

## API (for automation)
`POST` JSON (as `text/plain`) to the web-app URL. Always include `pass`.

| action | payload | does |
|---|---|---|
| `list` | — | returns `{ok, tasks:[…]}` |
| `add` | `{task:{title,quadrant,notes?,due?}}` | create |
| `update` | `{id, fields:{…}}` | edit any field |
| `delete` | `{id}` | remove |
| `reorder` | `{updates:[{id,quadrant,sort}]}` | batch move |
| `calendar` | `{id, start:ISO, minutes?}` | create Google Calendar event |

Quadrant ids: `us` urgent+simple · `uc` urgent+complex · `ls` long-term+simple ·
`lc` long-term+complex.
