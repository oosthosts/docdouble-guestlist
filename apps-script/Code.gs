/**
 * Eisenhower To-Do — Google Apps Script backend
 * =============================================
 * Stores tasks in a Google Sheet and (optionally) creates Google Calendar
 * events from a task. Acts as the always-on, multi-device sync server for the
 * PWA in /todo/index.html.
 *
 * SETUP (do this once):
 *  1. Go to https://sheets.google.com and create a new blank spreadsheet.
 *     Name it e.g. "Eisenhower To-Do".
 *  2. Extensions → Apps Script. Delete any starter code and paste THIS file in.
 *  3. Edit the CONFIG block below:
 *        - SECRET: pick a password. You'll type this once on each device.
 *        - CALENDAR_ID: leave as 'primary' to use your main Google Calendar.
 *  4. Click Deploy → New deployment → type "Web app".
 *        - Description:  todo api
 *        - Execute as:   Me
 *        - Who has access: Anyone   (the SECRET password protects it)
 *     Click Deploy, authorize the permissions it asks for, and COPY the
 *     "Web app URL" (ends in /exec).
 *  5. Paste that URL + your SECRET into the To-Do app's Settings screen
 *     (or hard-code API_URL near the top of /todo/index.html).
 *
 * To update later: Deploy → Manage deployments → edit (pencil) →
 *     New version → Deploy. The URL stays the same.
 */

// ----------------------------- CONFIG --------------------------------------
var CONFIG = {
  SECRET: 'change-me-to-a-password',   // <-- CHANGE THIS
  SHEET_NAME: 'Tasks',                 // worksheet/tab name (auto-created)
  CALENDAR_ID: 'primary',              // 'primary' = your default calendar
  DEFAULT_EVENT_MINUTES: 30            // default calendar event length
};

// Column order in the sheet. Do not reorder without updating the code.
var HEADERS = [
  'id', 'title', 'notes', 'quadrant', 'sort',
  'done', 'due', 'calendarEventId', 'calendarLink', 'created', 'updated'
];

// --------------------------- ENTRY POINTS ----------------------------------
function doGet(e)  { return handle(e, (e && e.parameter) || {}); }

function doPost(e) {
  var body = {};
  try {
    if (e && e.postData && e.postData.contents) {
      body = JSON.parse(e.postData.contents);
    }
  } catch (err) {
    // Fall back to form params if someone posts urlencoded
    body = (e && e.parameter) || {};
  }
  return handle(e, body);
}

function handle(e, p) {
  try {
    if (String(p.pass || '') !== String(CONFIG.SECRET)) {
      return json({ ok: false, error: 'auth' });
    }
    var action = String(p.action || 'list');
    switch (action) {
      case 'list':     return json({ ok: true, tasks: listTasks() });
      case 'add':      return json({ ok: true, task: addTask(p.task || p) });
      case 'update':   return json({ ok: true, task: updateTask(p.id, p.fields || {}) });
      case 'delete':   return json({ ok: true, id: deleteTask(p.id) });
      case 'reorder':  return json({ ok: true, updated: reorder(p.updates || []) });
      case 'calendar': return json(makeCalendarEvent(p.id, p.start, p.minutes));
      default:         return json({ ok: false, error: 'unknown_action' });
    }
  } catch (err) {
    return json({ ok: false, error: String(err && err.message || err) });
  }
}

// ------------------------------ STORAGE ------------------------------------
function sheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(CONFIG.SHEET_NAME);
    sh.appendRow(HEADERS);
    sh.setFrozenRows(1);
  }
  // Ensure header row exists / is correct
  if (sh.getLastRow() === 0) { sh.appendRow(HEADERS); sh.setFrozenRows(1); }
  return sh;
}

function rowsToObjects() {
  var sh = sheet();
  var values = sh.getDataRange().getValues();
  var out = [];
  for (var r = 1; r < values.length; r++) {
    var row = values[r];
    if (!row[0]) continue; // skip blank rows (no id)
    var obj = {};
    for (var c = 0; c < HEADERS.length; c++) obj[HEADERS[c]] = row[c];
    obj._row = r + 1; // 1-based sheet row
    out.push(obj);
  }
  return out;
}

function listTasks() {
  return rowsToObjects().map(cleanTask);
}

function cleanTask(o) {
  return {
    id: String(o.id),
    title: String(o.title || ''),
    notes: String(o.notes || ''),
    quadrant: String(o.quadrant || 'us'),
    sort: Number(o.sort || 0),
    done: o.done === true || o.done === 'TRUE' || o.done === 'true',
    due: o.due ? String(o.due) : '',
    calendarEventId: o.calendarEventId ? String(o.calendarEventId) : '',
    calendarLink: o.calendarLink ? String(o.calendarLink) : '',
    created: o.created ? String(o.created) : '',
    updated: o.updated ? String(o.updated) : ''
  };
}

function addTask(t) {
  var sh = sheet();
  var now = new Date().toISOString();
  var id = (t && t.id) ? String(t.id) : Utilities.getUuid();
  var task = {
    id: id,
    title: String((t && t.title) || '').slice(0, 500),
    notes: String((t && t.notes) || '').slice(0, 5000),
    quadrant: String((t && t.quadrant) || 'us'),
    sort: Number((t && t.sort) != null ? t.sort : Date.now()),
    done: !!(t && t.done),
    due: (t && t.due) ? String(t.due) : '',
    calendarEventId: '',
    calendarLink: '',
    created: now,
    updated: now
  };
  sh.appendRow(HEADERS.map(function (h) { return task[h]; }));
  return cleanTask(task);
}

function findRow(id) {
  var all = rowsToObjects();
  for (var i = 0; i < all.length; i++) {
    if (String(all[i].id) === String(id)) return all[i];
  }
  return null;
}

function updateTask(id, fields) {
  var sh = sheet();
  var rec = findRow(id);
  if (!rec) throw new Error('not_found');
  var editable = ['title', 'notes', 'quadrant', 'sort', 'done', 'due',
                  'calendarEventId', 'calendarLink'];
  editable.forEach(function (key) {
    if (fields.hasOwnProperty(key)) {
      var col = HEADERS.indexOf(key) + 1;
      sh.getRange(rec._row, col).setValue(fields[key]);
    }
  });
  sh.getRange(rec._row, HEADERS.indexOf('updated') + 1)
    .setValue(new Date().toISOString());
  return cleanTask(findRow(id));
}

function deleteTask(id) {
  var sh = sheet();
  var rec = findRow(id);
  if (!rec) return id;
  sh.deleteRow(rec._row);
  return id;
}

// Batch reorder / re-quadrant from drag-and-drop.
// updates = [{ id, quadrant, sort }, ...]
function reorder(updates) {
  var sh = sheet();
  var index = {};
  rowsToObjects().forEach(function (o) { index[String(o.id)] = o._row; });
  var n = 0;
  updates.forEach(function (u) {
    var row = index[String(u.id)];
    if (!row) return;
    if (u.hasOwnProperty('quadrant')) {
      sh.getRange(row, HEADERS.indexOf('quadrant') + 1).setValue(u.quadrant);
    }
    if (u.hasOwnProperty('sort')) {
      sh.getRange(row, HEADERS.indexOf('sort') + 1).setValue(Number(u.sort));
    }
    sh.getRange(row, HEADERS.indexOf('updated') + 1)
      .setValue(new Date().toISOString());
    n++;
  });
  return n;
}

// ----------------------------- CALENDAR ------------------------------------
function makeCalendarEvent(id, startIso, minutes) {
  var rec = findRow(id);
  if (!rec) return { ok: false, error: 'not_found' };
  var task = cleanTask(rec);
  var start = startIso ? new Date(startIso) : (task.due ? new Date(task.due) : null);
  if (!start || isNaN(start.getTime())) {
    return { ok: false, error: 'no_date' };
  }
  var mins = Number(minutes) > 0 ? Number(minutes) : CONFIG.DEFAULT_EVENT_MINUTES;
  var end = new Date(start.getTime() + mins * 60000);

  var cal = CONFIG.CALENDAR_ID === 'primary'
    ? CalendarApp.getDefaultCalendar()
    : CalendarApp.getCalendarById(CONFIG.CALENDAR_ID);
  if (!cal) return { ok: false, error: 'no_calendar' };

  var ev = cal.createEvent(task.title || 'To-Do', start, end, {
    description: task.notes || ''
  });
  var eventId = ev.getId();
  var link = 'https://calendar.google.com/calendar/r/eventedit/' +
             Utilities.base64Encode(eventId.split('@')[0] + ' ' +
             (CONFIG.CALENDAR_ID === 'primary' ? '' : CONFIG.CALENDAR_ID)).replace(/=+$/, '');

  updateTask(id, {
    calendarEventId: eventId,
    calendarLink: link,
    due: start.toISOString()
  });
  return { ok: true, eventId: eventId, link: link, start: start.toISOString() };
}

// ----------------------------- HELPERS -------------------------------------
function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
