#!/usr/bin/env python3
"""
scrape_brunsviga.py
Scraper für brunsviga-kulturzentrum.de → JSON

Stufe 1: Monatskalender → Datum, Zeit, Titel, URL pro Event
Ausgabe: brunsviga_events.json

WICHTIG — Kalender-HTML-Struktur:
  <td class="dayN curmonth [hasevents]">
    28                    ← Monatstag (plain text, VOR dem popup-div)
    <div class="popup">
      <a class="noarrow" title="Titel" href="/programm/...">
        <span class="date ">19:30 Uhr</span>
        <span class="title ">Titel</span>
      </a>
    </div>
  </td>

  dayN = Wochentagsspalte (1=Mo ... 7=So) — NICHT der Monatstag!
  Der Monatstag steht als erste Zahl im TD-Text-Inhalt.

Verwendung:
  python3 scrape_brunsviga.py
  python3 scrape_brunsviga.py --months 10
  python3 scrape_brunsviga.py --output meine.json
"""

import sys, re, json
from datetime import date, datetime
import urllib.request

BASE_URL       = 'https://www.brunsviga-kulturzentrum.de'
DEFAULT_MONTHS = 10
DEFAULT_OUTPUT = 'brunsviga_events.json'

MONTH_DE = {
    'Januar':1,'Februar':2,'März':3,'April':4,'Mai':5,'Juni':6,
    'Juli':7,'August':8,'September':9,'Oktober':10,'November':11,'Dezember':12,
}


def fetch(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=15) as r:
        return r.read().decode('utf-8', errors='replace')


def parse_month_html(html):
    """Parst einen Kalender-Monat.
    Gibt zurück: (year, month, events_dict, next_url)

    events_dict: {date: [{'title': str, 'time': str|None, 'url': str}, ...]}
    """
    # Monat/Jahr aus Kalender-Header
    m = re.search(r'<li>(\w+)\s+(\d{4})</li>', html)
    year = month = None
    if m:
        month = MONTH_DE.get(m.group(1), 0)
        year  = int(m.group(2))

    events = {}

    if year and month:
        # Jede curmonth-Zelle parsen
        # dayN = Wochentagsspalte, daher nur (.*?) als Capture
        for cell_html in re.findall(
                r'<td class="day\d+ curmonth[^"]*">(.*?)</td>', html, re.DOTALL):

            # Monatstag = erste Zahl im Zellen-Text (vor dem <div class="popup">)
            day_m = re.match(r'\s*(\d{1,2})\b', cell_html)
            if not day_m:
                continue
            try:
                d = date(year, month, int(day_m.group(1)))
            except ValueError:
                continue

            # Alle Events in der Zelle (ein <a class="noarrow"> pro Event)
            for a_tag, a_content in re.findall(
                    r'(<a\b[^>]*class="noarrow"[^>]*>)(.*?)</a>',
                    cell_html, re.DOTALL):
                title_m = re.search(r'title="([^"]+)"', a_tag)
                href_m  = re.search(r'href="([^"]+)"',  a_tag)
                if not title_m or not href_m:
                    continue

                title = title_m.group(1).strip()
                url   = href_m.group(1)

                # Download-Link-Einträge überspringen (BACKLOG 6)
                if title.lower().startswith('download'):
                    continue

                # Zeit aus <span class="date ...">HH:MM Uhr</span>
                time_m = re.search(
                    r'<span class="date[^"]*">(\d{1,2}:\d{2})\s*Uhr</span>',
                    a_content)
                time_str = time_m.group(1) if time_m else None

                if d not in events:
                    events[d] = []
                events[d].append({'title': title, 'time': time_str, 'url': url})

    # Nächsten Monat: URL aus "next"-Navigation
    m2 = re.search(r'class="next".*?CalendarNav\([\'"]([^\'"]+)[\'"]',
                   html, re.DOTALL)
    next_url = (BASE_URL + m2.group(1).replace('&amp;', '&')) if m2 else None

    return year, month, events, next_url


def scrape(months=DEFAULT_MONTHS):
    all_events = {}
    url = BASE_URL + '/programm/'

    for i in range(months):
        print(f'  Monat {i+1}/{months}: {url[:70]}...')
        try:
            html = fetch(url)
        except Exception as e:
            print(f'  ⚠ Fehler: {e}')
            break

        yr, mo, events, next_url = parse_month_html(html)
        if yr and mo:
            total = sum(len(v) for v in events.values())
            print(f'  → {mo:02d}/{yr}: {len(events)} Tage, {total} Events')
            all_events.update(events)
        else:
            print('  ⚠ Monat/Jahr nicht erkannt')

        if not next_url:
            print('  Kein Weiter-Link — fertig.')
            break
        url = next_url

    return all_events


def main():
    flags = sys.argv[1:]
    months = DEFAULT_MONTHS
    output = DEFAULT_OUTPUT

    i = 0
    while i < len(flags):
        if flags[i] == '--months' and i + 1 < len(flags):
            months = int(flags[i + 1])
            i += 2
        elif flags[i] == '--output' and i + 1 < len(flags):
            output = flags[i + 1]
            i += 2
        else:
            i += 1

    print(f'Brunsviga Event Scraper — {months} Monate')
    print(f'Ausgabe: {output}')
    print()

    all_events = scrape(months)

    total = sum(len(v) for v in all_events.values())
    print(f'\n→ {total} Events an {len(all_events)} Tagen gesamt')

    # JSON-Ausgabe: date-Keys als ISO-Strings
    data = {
        'scraped_at': datetime.now().isoformat(timespec='seconds'),
        'months_scraped': months,
        'events': {
            d.isoformat(): v
            for d, v in sorted(all_events.items())
        },
    }

    with open(output, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f'→ Gespeichert: {output}')


if __name__ == '__main__':
    main()
