# S&T Calculator — Travel & Attendance Log

**▶ Live tool: <https://mnquhe72.github.io/st-calculator/>**

Open that link and the calculator runs in the browser. No login, nothing to install — send the
link to anyone who needs it.

A single-file web page that fills in the **Lead Educator Travel & Attendance Log** for the
Spring Classes Programme (MIP 2026), then exports it to **Excel** or **PDF**.

Everything runs inside the page. No server, no login, no installation, and no data leaves the
device it is opened on.

---

## Using it

1. Open <https://mnquhe72.github.io/st-calculator/> — or, if you have the file, open `index.html`
   in any browser (Chrome, Edge, Firefox, Safari).
2. Fill in the details. The programme, school, educator and subject are pre-filled; change them
   for your own school.
   - Set the **start date** and **number of days**. A lesson start/end time is created for each day.
   - Enter the **starting speedometer reading** and the **one-way distance**. A round trip is
     twice that figure.
3. Click **Generate document**.
4. Use **Download Excel (.xlsx)**, **Print / Save as PDF**, or **Download PDF**.

Your entries are remembered in the browser on that device, so you only type them once.

### The travel rules built into the calculation

| Leg | Rule |
| --- | --- |
| Leave home | 45 minutes before the lesson starts |
| Arrive at school | 15 minutes before the lesson starts |
| Leave school | 10 minutes after the lesson ends |
| Arrive home | 30 minutes after the lesson ends |

The page warns you — it never blocks you — when:

- a day's round trip is more than **100 km**,
- the programme total is more than **500 km**,
- a return trip runs past midnight.

---

## Exporting

**Download Excel (.xlsx)** — writes a real Excel workbook, not an HTML file renamed to `.xls`.
It opens without the "file format does not match the extension" warning, and because each trip is
its own row with numeric odometer and kilometre cells, the columns can be summed and sorted
directly. The total is a live `=SUM()` formula.

**Print / Save as PDF** — opens the browser's print dialog; choose *Save as PDF*. This produces a
sharp, text-searchable A4 landscape document and works **offline**.

**Download PDF** — a one-click PDF, but it needs an internet connection the first time because it
uses a small library from a CDN. If you are offline this button is simply hidden, and nothing else
is affected. Print / Save as PDF is the more reliable of the two.

---

## Sharing it with someone

### Option A — the quickest (one file)

Send `index.html` on WhatsApp, by email, or via a shared drive. The recipient double-clicks it and
it opens in their browser. This works offline and needs nothing installed.

### Option B — a web link (recommended)

1. Create a public repository on GitHub (for example `st-calculator`).
2. Upload `index.html` and this `README.md` into it.
3. In the repository, open **Settings → Pages**.
4. Under *Build and deployment*, set **Source** to `Deploy from a branch`, then choose the
   **`main`** branch and the **`/ (root)`** folder, and save.
5. After a minute your link is live, in the form:

   ```
   https://<your-username>.github.io/st-calculator/
   ```

Anyone with that link can use the calculator in their browser. Nothing is installed, and no
GitHub account is needed to open it.

> A GitHub Pages link requires the repository to be **public**. On a free account, private
> repositories cannot publish a Pages site.

---

## Notes and limitations

- **Your details stay on your device.** They are kept in the browser's local storage, so a
  colleague opening the same link on their own device sees the default values, not yours.
- **Clearing your browser data clears your saved entries.** Click **Reset saved details** to go
  back to the shipped defaults.
- **Nothing is uploaded.** There is no server component and no tracking.
- **Print output** is set to A4 landscape with a 9 mm margin. On some browsers you may need to
  confirm *Landscape* in the print dialog.
- The programme title, school, educator and subject are editable fields, so the page is not tied
  to one school.

---

## For maintainers

The whole calculator is `index.html`: one file with its CSS and JavaScript inline. There is no
build step and no dependency to install.

Things you are most likely to change:

- **The travel rules and the 100 km / 500 km limits** — the `RULES` object near the top of the
  inline `<script>`.
- **The pre-filled default values** — the `value="..."` attributes on the form inputs in the
  markup.

The Excel writer is a small, dependency-free Office Open XML (ZIP + XML) generator inside the same
script. It is deliberately self-contained so the page keeps working offline.

### Tests

`tests/` holds two suites that run without a browser:

```bash
cd st-calculator

# Runs the page's real inline JavaScript against a stub DOM: travel-rule maths,
# dates, odometer chain, warnings, validation, and the bytes of the .xlsx package.
node tests/test_page.js

# Reads the workbook back with openpyxl and checks its structure, numeric typing,
# odometer chain and the SUM total.
pip install openpyxl lxml
python tests/accept_xlsx.py
```

Both must exit 0. `.github/workflows/tests.yml` runs them on every push.

Any configuration can be smoke-tested by pinning the inputs through the environment; the
workbook that the run produces is then checked by the Python suite:

```bash
STC_DISTANCE=150.25 STC_DAYS=5 STC_ODO=92451 STC_SUMMARY_ONLY=1 node tests/test_page.js
python tests/accept_xlsx.py tests/out/Travel_Log.xlsx 150.25 5 92451
```

`STC_SUMMARY_ONLY=1` skips the assertions that encode the default 45 km / 5 day scenario and
checks the shared behaviour only, which is what makes arbitrary inputs usable.
