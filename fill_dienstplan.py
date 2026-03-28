#!/usr/bin/env python3
"""
fill_dienstplan.py
Liest Events (von brunsviga-kulturzentrum.de oder JSON) und füllt
Veranstaltungs- und Show-Zeilen im Dienstplan-ODS.
Keine externen Abhängigkeiten — nur Python 3 stdlib.

Verwendung:
  python3 fill_dienstplan.py
  python3 fill_dienstplan.py input.ods output.ods
  python3 fill_dienstplan.py input.ods output.ods 6
  python3 fill_dienstplan.py input.ods output.ods 5 --overwrite
  python3 fill_dienstplan.py input.ods output.ods --json brunsviga_events.json
  python3 fill_dienstplan.py input.ods output.ods --json brunsviga_events.json --overwrite
"""

import sys, re, os, io, json, shutil, zipfile
from copy import deepcopy
from datetime import date
import xml.etree.ElementTree as ET
import urllib.request

# ─── Konfiguration ────────────────────────────────────────────────────────────

DEFAULT_SOURCE = '260118 Dienstplan__ M_A_J_neo-1.ods'
DEFAULT_OUTPUT = 'Dienstplan_aktuell.ods'
DEFAULT_MONTHS = 5
BASE_URL = 'https://www.brunsviga-kulturzentrum.de'

# ODF XML-Namespaces
TABLE  = 'urn:oasis:names:tc:opendocument:xmlns:table:1.0'
TEXT   = 'urn:oasis:names:tc:opendocument:xmlns:text:1.0'
OFFICE = 'urn:oasis:names:tc:opendocument:xmlns:office:1.0'
NS = {'table': TABLE, 'text': TEXT, 'office': OFFICE}

CELL_TAG    = f'{{{TABLE}}}table-cell'
REPEAT_ATTR = f'{{{TABLE}}}number-columns-repeated'
TEXT_P      = f'{{{TEXT}}}p'

MONTH_DE = {
    'Januar': 1, 'Februar': 2, 'März': 3, 'April': 4,
    'Mai': 5, 'Juni': 6, 'Juli': 7, 'August': 8,
    'September': 9, 'Oktober': 10, 'November': 11, 'Dezember': 12,
}

# Platzhalter-Werte, die überschrieben werden dürfen
PLACEHOLDER = re.compile(r'^[\s\-–—]*$')


# ─── Web-Scraping ─────────────────────────────────────────────────────────────

def fetch(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=15) as r:
        return r.read().decode('utf-8', errors='replace')


def parse_month_html(html):
    """Parst einen Kalender-Monat.
    Gibt zurück: (year, month, events_dict, next_url)

    events_dict: {date: [{'title': str, 'time': str|None, 'url': str}, ...]}

    WICHTIG: dayN in der TD-Klasse = Wochentagsspalte (1=Mo...7=So),
    NICHT der Monatstag! Der Monatstag steht als erste Zahl im TD-Text.
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

            # Monatstag = erste Zahl im Zellen-Text
            day_m = re.match(r'\s*(\d{1,2})\b', cell_html)
            if not day_m:
                continue
            try:
                d = date(year, month, int(day_m.group(1)))
            except ValueError:
                continue

            # Alle Events in der Zelle
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
                time_str = time_m.group(1) if time_m else None

                if d not in events:
                    events[d] = []
                events[d].append({'title': title, 'time': time_str,
                                  'url': href_m.group(1)})

    m2 = re.search(r'class="next".*?CalendarNav\([\'"]([^\'"]+)[\'"]',
                   html, re.DOTALL)
    next_url = (BASE_URL + m2.group(1).replace('&amp;', '&')) if m2 else None

    return year, month, events, next_url


def scrape_events(months=DEFAULT_MONTHS):
    all_events = {}
    url = BASE_URL + '/programm/'
    for i in range(months):
        print(f'  [{i+1}/{months}] {url[:75]}')
        try:
            html = fetch(url)
        except Exception as e:
            print(f'  ⚠ Fehler: {e}')
            break
        year, month, events, next_url = parse_month_html(html)
        if year and month:
            total = sum(len(v) for v in events.values())
            print(f'  → {month:02d}/{year}: {len(events)} Tage, {total} Events')
            all_events.update(events)
        if not next_url:
            break
        url = next_url
    return all_events


def load_json(path):
    """Lädt Events aus brunsviga_events.json."""
    with open(path, encoding='utf-8') as f:
        data = json.load(f)
    return {
        date.fromisoformat(k): v
        for k, v in data['events'].items()
    }


# ─── ODS XML-Hilfsfunktionen ──────────────────────────────────────────────────

def register_namespaces(xml_bytes):
    for prefix, uri in re.findall(
            r'xmlns:?(\w*)="([^"]+)"',
            xml_bytes[:5000].decode('utf-8', errors='replace')):
        ET.register_namespace(prefix or '', uri)


def cell_text(cell):
    t = cell.find(TEXT_P)
    return (t.text or '') if t is not None else ''


def set_cell_text(cell, value):
    t = cell.find(TEXT_P)
    if t is None:
        t = ET.SubElement(cell, TEXT_P)
    t.text = value
    for attr in list(cell.attrib):
        if 'value' in attr.lower() and 'type' not in attr.lower():
            del cell.attrib[attr]


def set_value_at_col(row, target_col, value):
    col = 0
    for child in list(row):
        if child.tag != CELL_TAG:
            continue
        repeat = int(child.get(REPEAT_ATTR, '1'))
        if col <= target_col < col + repeat:
            if repeat == 1:
                set_cell_text(child, value)
            else:
                insert_pos = next(
                    j for j, elem in enumerate(row) if elem is child)
                row.remove(child)
                child.attrib.pop(REPEAT_ATTR, None)
                offset = target_col - col
                for k in range(offset):
                    row.insert(insert_pos + k, deepcopy(child))
                target_cell = deepcopy(child)
                set_cell_text(target_cell, value)
                row.insert(insert_pos + offset, target_cell)
                remaining = repeat - offset - 1
                if remaining > 0:
                    tail = deepcopy(child)
                    tail.set(REPEAT_ATTR, str(remaining))
                    row.insert(insert_pos + offset + 1, tail)
            return
        col += repeat


def get_text_at_col(row, target_col):
    col = 0
    for child in row:
        if child.tag != CELL_TAG:
            continue
        repeat = int(child.get(REPEAT_ATTR, '1'))
        if col <= target_col < col + repeat:
            return cell_text(child)
        col += repeat
    return ''


def parse_date(val):
    m = re.match(r'^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$', val.strip())
    if not m:
        return None
    d, mo, yr = int(m.group(1)), int(m.group(2)), int(m.group(3))
    if yr < 100:
        yr += 2000
    try:
        return date(yr, mo, d)
    except ValueError:
        return None


def find_date_map(rows, start_idx):
    """Sucht rückwärts ab start_idx nach der Datumszeile.
    Gibt {col_index: date} zurück oder {}."""
    for back in range(1, 12):
        if start_idx - back < 0:
            break
        prev_cells = rows[start_idx - back].findall(CELL_TAG)
        if prev_cells and cell_text(prev_cells[0]) == '':
            col = 0
            date_map = {}
            for c in rows[start_idx - back]:
                if c.tag != CELL_TAG:
                    continue
                repeat = int(c.get(REPEAT_ATTR, '1'))
                if col > 0:
                    d = parse_date(cell_text(c))
                    if d:
                        date_map[col] = d
                col += min(repeat, 8 - col)
                if col >= 8:
                    break
            if date_map:
                return date_map
    return {}


# ─── Füll-Logik ───────────────────────────────────────────────────────────────

def fill_ods(source, output, events, overwrite=False):
    shutil.copy2(source, output)

    with zipfile.ZipFile(output, 'r') as z:
        raw_content = z.read('content.xml')
        all_files   = {n: z.read(n) for n in z.namelist()}

    register_namespaces(raw_content)
    tree = ET.parse(io.BytesIO(raw_content))
    root = tree.getroot()

    sheets = root.findall('.//table:table', NS)
    if not sheets:
        print('Fehler: Keine Tabellen in der ODS-Datei gefunden.')
        return
    rows = sheets[0].findall('table:table-row', NS)

    filled = kept = 0

    for i, row in enumerate(rows):
        first_cells = row.findall(CELL_TAG)
        if not first_cells:
            continue
        label = cell_text(first_cells[0]).strip()

        if label not in ('Veranstaltung', 'Show'):
            continue

        date_map = find_date_map(rows, i)
        if not date_map:
            continue

        for col, d in date_map.items():
            if d not in events:
                continue

            ev_list = events[d]

            if label == 'Veranstaltung':
                new_val = ' / '.join(e['title'] for e in ev_list)
            else:  # Show
                times = [e['time'] for e in ev_list if e.get('time')]
                if not times:
                    continue
                new_val = ' / '.join(times)

            curr_val = get_text_at_col(row, col)
            if curr_val and not PLACEHOLDER.match(curr_val) and not overwrite:
                kept += 1
                print(f'  ↷ {d.strftime("%d.%m.%y")} {label} Col{col}: '
                      f'"{curr_val}" — behalten')
                continue

            set_value_at_col(row, col, new_val)
            filled += 1
            print(f'  ✓ {d.strftime("%d.%m.%y")} [{label}]: {new_val}')

    print(f'\nErgebnis: {filled} gefüllt, {kept} behalten (bereits belegt)')

    out_buf = io.BytesIO()
    tree.write(out_buf, xml_declaration=True, encoding='UTF-8')

    with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED) as zout:
        for name, data in all_files.items():
            if name == 'content.xml':
                zout.writestr(name, out_buf.getvalue())
            else:
                zout.writestr(name, data)

    print(f'→ Gespeichert: {output}')


# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    args  = [a for a in sys.argv[1:] if not a.startswith('--')]
    flags = sys.argv[1:]

    source    = args[0] if len(args) > 0 else DEFAULT_SOURCE
    output    = args[1] if len(args) > 1 else DEFAULT_OUTPUT
    overwrite = '--overwrite' in flags

    # JSON-Option: --json <datei>
    json_file = None
    for i, f in enumerate(flags):
        if f == '--json' and i + 1 < len(flags):
            json_file = flags[i + 1]
            break

    # Monate nur relevant ohne --json
    months = DEFAULT_MONTHS
    if not json_file:
        numeric = [a for a in args[2:] if a.isdigit()]
        if numeric:
            months = int(numeric[0])

    if not os.path.exists(source):
        sys.exit(f'Fehler: Quelldatei nicht gefunden: {source}')

    print('Brunsviga Dienstplan Filler')
    print(f'Quelle  : {source}')
    print(f'Ausgabe : {output}')
    if json_file:
        print(f'Modus   : JSON ({json_file})')
    else:
        print(f'Monate  : {months}')
    print(f'Modus   : {"Überschreiben" if overwrite else "Nur leere Zellen"}')
    print()

    if json_file:
        if not os.path.exists(json_file):
            sys.exit(f'Fehler: JSON nicht gefunden: {json_file}')
        print(f'Lade Events aus {json_file}...')
        events = load_json(json_file)
    else:
        print('Lade Events von Website...')
        events = scrape_events(months)

    total = sum(len(v) for v in events.values())
    print(f'→ {total} Events an {len(events)} Tagen\n')

    if not events:
        sys.exit('Keine Events geladen — Abbruch.')

    print('Fülle ODS...')
    fill_ods(source, output, events, overwrite=overwrite)


if __name__ == '__main__':
    main()
