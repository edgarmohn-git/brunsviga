// ──────────────────────────────────────────────────────────────
// Brunsviga Seed-Daten — automatisch befüllt beim ersten Start
// Quelle: brunsviga-kulturzentrum.de/programm/ (Stand 2026-03-02)
// ──────────────────────────────────────────────────────────────

function getSeedEvents() {
  function ev(id, title, date, start, end, type, notes) {
    return { id, title, date, start, end: end || '', type, notes: notes || '', assignedStaff: [], requiredStaff: [] };
  }

  return [

    // ── MÄRZ 2026 ────────────────────────────────────────────
    ev('s01', 'DESiMOs Spezial Club',                '2026-03-03', '20:00', '23:00', 'Comedy',    'Mix-Show mit hochkarätigen Überraschungsgästen'),
    ev('s02', 'Joab Nist – Notes of Berlin',         '2026-03-05', '20:00', '23:00', 'Konzert',   ''),
    ev('s03', 'Vanessa Maurischat – Zündstoff',      '2026-03-06', '20:00', '23:00', 'Comedy',    ''),
    ev('s04', 'GTD COMEDY SLAM – Vorrunde',          '2026-03-07', '20:00', '23:00', 'Comedy',    ''),
    ev('s05', 'Martin Zingsheim',                    '2026-03-08', '18:00', '21:00', 'Comedy',    '"irgendwas mach ich falsch"'),
    ev('s06', 'Pauline Kalender & Ole Henner Maaß', '2026-03-10', '19:00', '22:00', 'Lesung',    'Vortrag: Per Rad, Anhalter und Öffis quer durch Asien'),
    ev('s07', 'Patrizia Moresco – Overkill',         '2026-03-11', '20:00', '23:00', 'Comedy',    ''),
    ev('s08', 'NABU Vortrag',                        '2026-03-12', '19:00', '21:00', 'Sonstiges', 'Schnecken entdecken – Vielfalt im Verborgenen'),
    ev('s09', 'Michael Frowin',                      '2026-03-12', '20:00', '23:00', 'Comedy',    '"Das wird ein Vorspiel haben"'),
    ev('s10', 'Krämer & Tschirpke',                  '2026-03-13', '20:00', '23:00', 'Comedy',    'Ich\'n Lied-Du\'n Lied, Level 2'),
    ev('s11', 'Schwester Lilli – Lachen auf Rezept', '2026-03-14', '20:00', '23:00', 'Comedy',    ''),
    ev('s12', 'Brunsviga Freundeskreis',             '2026-03-15', '17:00', '20:00', 'Theater',   'Das Quartett – "Der eiserne Gustav"'),
    ev('s13', 'Die Unfassbaren',                     '2026-03-16', '19:00', '22:00', 'Sonstiges', 'Magic Comedy und Hypnose — AUSVERKAUFT'),
    ev('s14', 'Ingo Appelt – Männer nerven stark',   '2026-03-18', '20:00', '23:00', 'Comedy',    'AUSVERKAUFT'),
    ev('s15', 'Christine Prayon – Abschiedstour',    '2026-03-19', '20:00', '23:00', 'Comedy',    ''),
    ev('s16', 'Tobii Live – Mutti & Friends',        '2026-03-20', '20:00', '23:00', 'Comedy',    ''),
    ev('s17', 'Wladimir Kaminer',                    '2026-03-21', '19:00', '22:00', 'Lesung',    'Das geheime Leben der Deutschen'),
    ev('s18', 'Caveman – Du sammeln, ich jagen!',    '2026-03-22', '18:00', '21:00', 'Theater',   ''),
    ev('s19', 'Welt der Puppen (1. Vst. 15:00)',     '2026-03-24', '15:00', '16:30', 'Theater',   'Wie Findus zu Pettersson kam — Kindertheater'),
    ev('s20', 'Welt der Puppen (2. Vst. 17:00)',     '2026-03-24', '17:00', '18:30', 'Theater',   'Wie Findus zu Pettersson kam — Kindertheater'),
    ev('s21', 'Welt der Puppen (1. Vst. 15:00)',     '2026-03-25', '15:00', '16:30', 'Theater',   'Wie Findus zu Pettersson kam — Kindertheater'),
    ev('s22', 'Welt der Puppen (2. Vst. 17:00)',     '2026-03-25', '17:00', '18:30', 'Theater',   'Wie Findus zu Pettersson kam — Kindertheater'),
    ev('s23', 'Leseflair Frühjahrslese – Poetry Slam','2026-03-26','19:30', '22:30', 'Lesung',    '3. Leseflair Poetry Slam'),
    ev('s24', 'Leseflair Frühjahrslese – Salon',     '2026-03-27', '19:30', '22:30', 'Lesung',    'Der Mörderische Salon'),
    ev('s25', 'Leseflair – Buchmesse Regio',         '2026-03-28', '10:00', '18:00', 'Sonstiges', 'Ganztägige Buchmesse'),
    ev('s26', 'Annika Strauss liest "REM"',          '2026-03-28', '19:30', '22:00', 'Lesung',    ''),
    ev('s27', 'Der Tod – Pest of',                   '2026-03-29', '19:00', '22:00', 'Comedy',    'Das Beste aus 13 Jahren'),
    ev('s28', 'DESiMOs Spezial Club',                '2026-03-31', '20:00', '23:00', 'Comedy',    'Mix-Show mit Überraschungsgästen'),

    // ── APRIL 2026 ───────────────────────────────────────────
    ev('s29', 'Benni Stark',                         '2026-04-09', '20:00', '23:00', 'Comedy',    '"Schon lustig, wenn\'s witzig ist!"'),
    ev('s30', 'Marcel Kösling – Moment Mal!',        '2026-04-10', '20:00', '23:00', 'Comedy',    ''),
    ev('s31', 'Soulviertel',                         '2026-04-11', '20:00', '23:00', 'Konzert',   'Willkommen im SOULVIERTEL!'),
    ev('s32', 'Anny Hartmann – Klima-Ballerina',     '2026-04-12', '19:00', '22:00', 'Comedy',    ''),
    ev('s33', 'Marc Weide – Magier des Monats',      '2026-04-16', '20:00', '23:00', 'Sonstiges', 'AUSVERKAUFT'),
    ev('s34', 'Suchtpotenzial – (S)HITSTORM',        '2026-04-17', '20:00', '23:00', 'Comedy',    'AUSVERKAUFT'),
    ev('s35', 'Mathias Tretter – Souverän',          '2026-04-18', '20:00', '23:00', 'Comedy',    ''),
    ev('s36', 'Matthias Egersdörfer – langsam',      '2026-04-19', '19:00', '22:00', 'Comedy',    ''),
    ev('s37', 'Rudelsingen',                         '2026-04-22', '19:30', '22:30', 'Konzert',   '25. Braunschweiger Rudelsingen'),
    ev('s38', 'Studio-Bühne Braunschweig',           '2026-04-24', '19:30', '22:00', 'Theater',   'Kaufhaus in Trouble'),
    ev('s39', 'Studio-Bühne Braunschweig (15:30)',   '2026-04-25', '15:30', '18:00', 'Theater',   'Kaufhaus in Trouble — 1. Vorstellung'),
    ev('s40', 'Studio-Bühne Braunschweig (19:30)',   '2026-04-25', '19:30', '22:00', 'Theater',   'Kaufhaus in Trouble — 2. Vorstellung'),
    ev('s41', 'Fashion-Börse – Frauenflohmarkt',     '2026-04-26', '11:00', '18:00', 'Sonstiges', ''),
    ev('s42', 'Welt der Puppen – Das Neinhorn (15:00)','2026-04-28','15:00','16:30', 'Theater',   'Kindertheater — 1. Vorstellung'),
    ev('s43', 'Welt der Puppen – Das Neinhorn (17:00)','2026-04-28','17:00','18:30', 'Theater',   'Kindertheater — 2. Vorstellung'),
    ev('s44', 'Welt der Puppen – Das Neinhorn (15:00)','2026-04-29','15:00','16:30', 'Theater',   'Kindertheater — 1. Vorstellung'),
    ev('s45', 'Welt der Puppen – Das Neinhorn (17:00)','2026-04-29','17:00','18:30', 'Theater',   'Kindertheater — 2. Vorstellung'),
    ev('s46', 'Tanz in den Mai',                     '2026-04-30', '20:00', '02:00', 'Party',     'mit DJ Soundschwester'),

    // ── MAI 2026 ─────────────────────────────────────────────
    ev('s47', 'GTD COMEDY SLAM – Bundesfinale 2026', '2026-05-02', '20:00', '23:00', 'Comedy',    ''),
    ev('s48', 'Jan van Weyde – Neues Programm 2026', '2026-05-03', '20:00', '23:00', 'Comedy',    ''),
    ev('s49', 'Horst Evers',                         '2026-05-06', '20:00', '23:00', 'Comedy',    '"So gesehen natürlich lustig"'),
    ev('s50', 'Christian Schulte-Loh – Import Export','2026-05-08', '20:00', '23:00', 'Comedy',   ''),
    ev('s51', 'Guido Cantz – Komische Zeiten',       '2026-05-09', '20:00', '23:00', 'Comedy',    ''),
    ev('s52', 'Braunschweiger Akkordeon-Orchester',  '2026-05-10', '17:00', '20:00', 'Konzert',   'Jahreskonzert "Zwischen Tasten und Knöpfen"'),
    ev('s53', 'Theaterklub FindlingsRaum – Herzklopfen','2026-05-18','18:00','21:00','Theater',   ''),
    ev('s54', 'Theaterklub FindlingsRaum – Herzklopfen','2026-05-19','18:00','21:00','Theater',   ''),
    ev('s55', 'Theaterklub RollenBande',             '2026-05-27', '18:00', '21:00', 'Theater',   'Das schwimmende Theater'),
    ev('s56', 'Theaterklub RollenBande',             '2026-05-28', '18:00', '21:00', 'Theater',   'Das schwimmende Theater'),
    ev('s57', 'Kinderzauberei – Lachen und Staunen', '2026-05-29', '16:30', '18:00', 'Sonstiges', 'mit Voßi'),
    ev('s58', 'Kinderdisko',                         '2026-05-30', '16:00', '18:00', 'Sonstiges', 'für 3- bis 8-Jährige'),

    // ── JUNI 2026 ────────────────────────────────────────────
    ev('s59', 'Schultheaterwoche – Tag 1',           '2026-06-01', '11:30', '20:00', 'Theater',   '55. Braunschweiger Schultheaterwoche – Schule macht Theater!'),
    ev('s60', 'Schultheaterwoche – Tag 2',           '2026-06-02', '11:30', '20:00', 'Theater',   '55. Braunschweiger Schultheaterwoche'),
    ev('s61', 'Schultheaterwoche – Tag 3',           '2026-06-03', '11:30', '20:00', 'Theater',   '55. Braunschweiger Schultheaterwoche'),
    ev('s62', 'Schultheaterwoche – Tag 4',           '2026-06-04', '11:30', '20:00', 'Theater',   '55. Braunschweiger Schultheaterwoche'),
    ev('s63', 'Robert Kreis – Eingekreist!',         '2026-06-05', '20:00', '23:00', 'Comedy',    ''),
    ev('s64', 'LaLeLu – LaLeLuja!',                  '2026-06-06', '20:00', '23:00', 'Konzert',   'a cappella comedy — 30 Jahre Jubiläumstour'),
    ev('s65', 'GTD COMEDY SLAM – Vorrunde',          '2026-06-13', '20:00', '23:00', 'Comedy',    ''),
    ev('s66', 'Veikko Bartel',                       '2026-06-19', '19:30', '22:00', 'Lesung',    'Wahre Fälle eines Strafverteidigers'),
    ev('s67', 'Musikschule Musikuß – Konzert',       '2026-06-24', '18:00', '21:00', 'Konzert',   'Projekt-Konzert — Tag 1'),
    ev('s68', 'Musikschule Musikuß – Konzert',       '2026-06-25', '18:00', '21:00', 'Konzert',   'Projekt-Konzert — Tag 2'),
    ev('s69', 'Musikschule Musikuß – Konzert',       '2026-06-26', '18:00', '21:00', 'Konzert',   'Projekt-Konzert — Tag 3'),
    ev('s70', 'Meik Gudermann – Menners!',           '2026-06-27', '20:00', '23:00', 'Lesung',    'Ein Gespräch über Männer'),

    // ── AUGUST 2026 ──────────────────────────────────────────
    ev('s71', 'Leseflair Festival – Sarah Kuttner',  '2026-08-18', '20:00', '22:30', 'Lesung',    'Liest: "Mama & Sam"'),
    ev('s72', 'Klaus-Peter Wolf – Lesung',           '2026-08-19', '20:00', '22:30', 'Lesung',    'Leseflair Festival 2026'),
    ev('s73', 'Leseflair Festival – Poetry Slam',    '2026-08-20', '19:30', '22:30', 'Lesung',    '4. Leseflair Poetry Slam'),
    ev('s74', 'Hoffest der Brunsviga 2026',          '2026-08-30', '15:00', '22:00', 'Party',     ''),

    // ── SEPTEMBER 2026 ───────────────────────────────────────
    ev('s75', 'Unterwegs – die Reise GmbH',          '2026-09-04', '14:00', '17:00', 'Sonstiges', 'Infonachmittag Klassenfahrten'),
    ev('s76', 'GTD COMEDY SLAM – Vorrunde',          '2026-09-05', '20:00', '23:00', 'Comedy',    ''),
    ev('s77', 'Fashion-Börse – Frauenflohmarkt',     '2026-09-06', '11:00', '18:00', 'Sonstiges', ''),
    ev('s78', 'Roland Jankowsky',                    '2026-09-10', '20:00', '23:00', 'Comedy',    'Die kriminellen Geschichten des O...'),
    ev('s79', 'Christoph Sieber – Weitermachen!',    '2026-09-12', '20:00', '23:00', 'Comedy',    ''),
    ev('s80', 'Musikschule Musikuß – De Laatste Noot','2026-09-13','15:00', '18:00', 'Konzert',   ''),
    ev('s81', 'MASUD AKBARZADEH – Playlist',         '2026-09-16', '20:00', '23:00', 'Konzert',   ''),
    ev('s82', 'Tanzend ins Wochenende',              '2026-09-18', '20:00', '02:00', 'Party',     'mit DJ Ringo'),
    ev('s83', 'Kinderdisko',                         '2026-09-19', '16:00', '18:00', 'Sonstiges', 'für 3- bis 8-Jährige'),
    ev('s84', 'Vintage Bazar',                       '2026-09-20', '11:00', '18:00', 'Sonstiges', 'Original Vintage Bazar'),
    ev('s85', 'Jochen Malmsheimer',                  '2026-09-23', '20:00', '23:00', 'Comedy',    ''),
  ];
}
