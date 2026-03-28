#!/usr/bin/env python3
"""
extend_dienstplan.py
Erweitert den Brunsviga-Dienstplan um neue Wochen (4.5.26 – 31.12.26)
und füllt Veranstaltungs- und Show-Zeilen ein.
Keine externen Abhängigkeiten — nur Python 3 stdlib.

Wochenblock-Struktur (16 Zeilen + 1 Trenner):
  A-Woche (grün): ce6-Datumszellen, ce7-Labels, ce20-Wochentage
  B-Woche (blau): ce9-Datumszellen, ce10-Labels, ce22-Wochentage
  Persönliche Zellen: ce12-Label, ce23-Daten
  Event-Blöcke: Technik/Einlass/Show: ce8-Label, ce12-Daten

Verwendung:
  python3 extend_dienstplan.py
  python3 extend_dienstplan.py input.ods output.ods
  python3 extend_dienstplan.py input.ods output.ods --json brunsviga_events.json
"""

import sys, re, os, json, shutil, zipfile
from datetime import date, timedelta
import urllib.request

# ─── Konfiguration ────────────────────────────────────────────────────────────

DEFAULT_SOURCE = '260118 Dienstplan__ M_A_J_neo-1.ods'
DEFAULT_OUTPUT = 'Dienstplan_erweitert.ods'
START_DATE     = date(2026, 5, 4)    # erster Montag nach bestehendem Sheet
END_DATE       = date(2026, 12, 31)

BASE_URL = 'https://www.brunsviga-kulturzentrum.de'

MONTH_DE = {
    'Januar':1,'Februar':2,'März':3,'April':4,'Mai':5,'Juni':6,
    'Juli':7,'August':8,'September':9,'Oktober':10,'November':11,'Dezember':12,
}
WEEKDAYS_DE = ['Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag','Sonntag']

# Personal-Zeilen (Label + 7 leere Datenzellen)
PERSONAL = ['Jörg', 'Matthias', 'Ahri', 'Lale', 'Tim']

# ─── Web-Scraping ─────────────────────────────────────────────────────────────

def fetch(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=15) as r:
        return r.read().decode('utf-8', errors='replace')


def parse_month_html(html):
    """Parst einen Kalender-Monat → (year, month, events_dict, next_url)
    events_dict: {date: [{'title': str, 'time': str|None, 'url': str}, ...]}

    WICHTIG: dayN = Wochentagsspalte (1=Mo...7=So), NICHT Monatstag!
    Monatstag = erste Zahl im TD-Textinhalt.
    """
    m = re.search(r'<li>(\w+)\s+(\d{4})</li>', html)
    year = month = None
    if m:
        month = MONTH_DE.get(m.group(1), 0)
        year  = int(m.group(2))

    events = {}
    if year and month:
        for cell_html in re.findall(
                r'<td class="day\d+ curmonth[^"]*">(.*?)</td>', html, re.DOTALL):
            day_m = re.match(r'\s*(\d{1,2})\b', cell_html)
            if not day_m:
                continue
            try:
                d = date(year, month, int(day_m.group(1)))
            except ValueError:
                continue
            for a_tag, a_content in re.findall(
                    r'(<a\b[^>]*class="noarrow"[^>]*>)(.*?)</a>',
                    cell_html, re.DOTALL):
                title_m = re.search(r'title="([^"]+)"', a_tag)
                href_m  = re.search(r'href="([^"]+)"',  a_tag)
                if not title_m or not href_m:
                    continue
                title = title_m.group(1).strip()
                if title.lower().startswith('download'):
                    continue
                time_m = re.search(
                    r'<span class="date[^"]*">(\d{1,2}:\d{2})\s*Uhr</span>',
                    a_content)
                if d not in events:
                    events[d] = []
                events[d].append({'title': title,
                                  'time': time_m.group(1) if time_m else None,
                                  'url': href_m.group(1)})

    m2 = re.search(r'class="next".*?CalendarNav\([\'"]([^\'"]+)[\'"]',
                   html, re.DOTALL)
    next_url = (BASE_URL + m2.group(1).replace('&amp;', '&')) if m2 else None
    return year, month, events, next_url


def scrape_events():
    all_events = {}
    url = BASE_URL + '/programm/'
    for i in range(20):
        print(f'  Monat {i+1}: {url[:70]}...')
        try:
            html = fetch(url)
        except Exception as e:
            print(f'  ⚠ Fehler: {e}')
            break
        yr, mo, events, next_url = parse_month_html(html)
        if yr and mo:
            total = sum(len(v) for v in events.values())
            print(f'  → {mo:02d}/{yr}: {len(events)} Tage, {total} Events')
            if yr == 2026 and mo >= 5:
                all_events.update(events)
            if (yr == 2026 and mo >= 12) or yr > 2026:
                break
        if not next_url:
            break
        url = next_url
    return all_events


def load_json(path):
    with open(path, encoding='utf-8') as f:
        data = json.load(f)
    return {date.fromisoformat(k): v for k, v in data['events'].items()}


# ─── XML-Hilfsfunktionen ──────────────────────────────────────────────────────

TRAILING = '<table:table-cell table:number-columns-repeated="1016"/>'


def _esc(s):
    return s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')


def date_display(d):
    return f'{d.day}.{d.month}.{str(d.year)[2:]}'


def mk_row(inner, style='ro2'):
    return f'<table:table-row table:style-name="{style}">{inner}</table:table-row>'


def separator():
    return mk_row('<table:table-cell table:number-columns-repeated="1024"/>', 'ro1')


def date_cell(d, ce):
    return (f'<table:table-cell table:style-name="{ce}"'
            f' office:value-type="date" office:date-value="{d.isoformat()}">'
            f'<text:p>{date_display(d)}</text:p></table:table-cell>')


def str_cell(ce, text):
    return (f'<table:table-cell table:style-name="{ce}"'
            f' office:value-type="string">'
            f'<text:p>{_esc(text)}</text:p></table:table-cell>')


def empty_cell(ce):
    return f'<table:table-cell table:style-name="{ce}"/>'


def empty_repeat(ce, n):
    return f'<table:table-cell table:style-name="{ce}" table:number-columns-repeated="{n}"/>'


# ─── Wochen-Block bauen ───────────────────────────────────────────────────────

def make_week_block(mon, events, week_idx):
    """16 Zeilen + Trenner für eine Woche (Mo–So).
    week_idx % 2 == 0  →  A-Woche (grün): ce6/ce7/ce20
    week_idx % 2 == 1  →  B-Woche (blau): ce9/ce10/ce22
    """
    week = [mon + timedelta(days=i) for i in range(7)]
    green = (week_idx % 2 == 0)

    # Farb-Styles je nach A/B
    ce_date = 'ce6' if green else 'ce9'    # Datumszellen
    ce_lbl  = 'ce7' if green else 'ce10'  # Event-Zeilen-Label + Wochentag-Label
    ce_wday = 'ce20' if green else 'ce22' # Wochentag-Zellen

    out = []

    # ── Block 1: Dienstplan ─────────────────────────────────────────────

    # Row 1: Datumszeile
    date_row = (empty_cell(ce_date)
                + ''.join(date_cell(d, ce_date) for d in week)
                + TRAILING)
    out.append(mk_row(date_row))

    # Row 2: Wochentage
    wd_row = (empty_cell(ce_lbl)
              + ''.join(str_cell(ce_wday, wd) for wd in WEEKDAYS_DE)
              + TRAILING)
    out.append(mk_row(wd_row))

    # Rows 3–7: Personal (Jörg, Matthias, Ahri, Lale, Tim)
    for name in PERSONAL:
        out.append(mk_row(str_cell('ce12', name) + empty_repeat('ce23', 7) + TRAILING))

    # Row 8: Einlasshilfe
    out.append(mk_row(str_cell('ce8', 'Einlasshilfe') + empty_repeat('ce23', 7) + TRAILING))

    # ── Block 2: Veranstaltung ──────────────────────────────────────────

    # Row 9: Datumszeile (identisch)
    out.append(mk_row(date_row))

    # Row 10: Wochentage (identisch)
    out.append(mk_row(wd_row))

    # Row 11: Veranstaltung
    ev_cells = str_cell(ce_lbl, 'Veranstaltung')
    for d in week:
        ev_list = events.get(d, [])
        if ev_list:
            ev_cells += str_cell(ce_lbl, ' / '.join(e['title'] for e in ev_list))
        else:
            ev_cells += empty_cell(ce_lbl)
    ev_cells += TRAILING
    out.append(mk_row(ev_cells))

    # Row 12: Veranstalter (leer)
    out.append(mk_row(str_cell(ce_lbl, 'Veranstalter') + empty_repeat(ce_lbl, 7) + TRAILING))

    # Row 13: Technik (leer)
    out.append(mk_row(str_cell('ce8', 'Technik') + empty_repeat('ce12', 7) + TRAILING))

    # Row 14: Eintreffen Technik (leer)
    out.append(mk_row(str_cell('ce8', 'Eintreffen Technik ') + empty_repeat('ce12', 7) + TRAILING))

    # Row 15: Einlass (leer — Website liefert keine Einlasszeiten)
    out.append(mk_row(str_cell('ce8', 'Einlass ') + empty_repeat('ce12', 7) + TRAILING))

    # Row 16: Show — Startzeiten aus Website
    show_cells = str_cell('ce8', 'Show')
    for d in week:
        ev_list = events.get(d, [])
        times = [e['time'] for e in ev_list if e.get('time')]
        if times:
            show_cells += str_cell('ce12', ' / '.join(times))
        else:
            show_cells += empty_cell('ce12')
    show_cells += TRAILING
    out.append(mk_row(show_cells))

    # Row 17: Trenner
    out.append(separator())

    return '\n'.join(out)


# ─── ODS bearbeiten ───────────────────────────────────────────────────────────

def extend_ods(source, output, events):
    shutil.copy2(source, output)

    with zipfile.ZipFile(output, 'r') as z:
        raw = z.read('content.xml').decode('utf-8')
        all_files = {n: z.read(n) for n in z.namelist()}

    # Einfügepunkt: direkt vor dem riesigen Leerzeilen-Block am Ende
    m = re.search(r'<table:table-row[^>]+table:number-rows-repeated="\d{5,}"', raw)
    insert_pos = m.start() if m else raw.rfind('</table:table>')
    print(f'Einfügepunkt: XML-Position {insert_pos}')

    # Wochenblöcke generieren
    blocks = []
    current = START_DATE
    week_idx = 0
    filled_days = 0

    while current <= END_DATE:
        blocks.append(make_week_block(current, events, week_idx))
        for i in range(7):
            if (current + timedelta(days=i)) in events:
                filled_days += 1
        current += timedelta(weeks=1)
        week_idx += 1

    last_monday = current - timedelta(weeks=1)
    last_sunday = last_monday + timedelta(days=6)
    print(f'{week_idx} Wochen: {START_DATE.strftime("%d.%m.%y")} – '
          f'{last_sunday.strftime("%d.%m.%y")}')
    print(f'{filled_days} Tage mit Website-Events vorausgefüllt')

    insert_xml = '\n' + '\n'.join(blocks) + '\n'
    new_content = raw[:insert_pos] + insert_xml + raw[insert_pos:]

    with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED) as zout:
        for name, data in all_files.items():
            if name == 'content.xml':
                zout.writestr(name, new_content.encode('utf-8'))
            else:
                zout.writestr(name, data)

    print(f'→ Gespeichert: {output}')


# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    args  = [a for a in sys.argv[1:] if not a.startswith('--')]
    flags = sys.argv[1:]

    source = args[0] if len(args) > 0 else DEFAULT_SOURCE
    output = args[1] if len(args) > 1 else DEFAULT_OUTPUT

    json_file = None
    for i, f in enumerate(flags):
        if f == '--json' and i + 1 < len(flags):
            json_file = flags[i + 1]
            break

    if not os.path.exists(source):
        sys.exit(f'Fehler: Quelldatei nicht gefunden: {source}')

    print('Brunsviga Dienstplan Extender')
    print(f'Quelle  : {source}')
    print(f'Ausgabe : {output}')
    print(f'Zeitraum: {START_DATE.strftime("%d.%m.%Y")} – {END_DATE.strftime("%d.%m.%Y")}')
    print(f'Farbe   : Woche 0 = A (grün/ce6), Woche 1 = B (blau/ce9), alternierend')
    print()

    if json_file:
        if not os.path.exists(json_file):
            sys.exit(f'Fehler: JSON nicht gefunden: {json_file}')
        print(f'Lade Events aus {json_file}...')
        events = load_json(json_file)
    else:
        print('Lade Events von Website (Mai–Dez 2026)...')
        events = scrape_events()

    total = sum(len(v) for v in events.values())
    print(f'→ {total} Events an {len(events)} Tagen\n')

    print('Erweitere ODS...')
    extend_ods(source, output, events)


if __name__ == '__main__':
    main()
