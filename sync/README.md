# Brunsviga — Sync-Ordner

Dieser Ordner enthält CSV-Vorlagen, mit denen Jörg Daten in Excel pflegen
und anschließend in die Brunsviga-App importieren kann.

---

## Workflow

1. **Vorlage öffnen** — `personal-vorlage.csv` oder `events-vorlage.csv` in Excel öffnen
2. **Daten eintragen** — Daten wie gewohnt in Excel pflegen
3. **Als CSV speichern** — Datei → Speichern unter → Format: CSV (Semikolon-getrennt)
4. **In der App importieren** — Zahnrad-Symbol ⚙ → Tab „Import / Export" → CSV-Datei auswählen → Importieren

> **Wichtig:** Beim CSV-Export aus Excel unbedingt „CSV UTF-8 (durch Trennzeichen getrennt)"
> oder „CSV (Semikolon-getrennt)" wählen — NICHT „CSV (durch Kommas getrennt)".

---

## Vorlagen

| Datei                   | Inhalt                              |
|-------------------------|-------------------------------------|
| `personal-vorlage.csv`  | Mitarbeiterliste mit allen Feldern  |
| `events-vorlage.csv`    | Eventliste mit allen Feldern        |

---

## Hinweise zum Import

- **Personal-Import:** Fügt neue Mitarbeiter hinzu. Bestehende Einträge mit gleicher E-Mail/Name werden übersprungen.
- **Event-Import:** Fügt neue Events hinzu. Bestehende Events mit gleichem Datum + Titel werden übersprungen.
- **Fehlermeldung?** Prüfe, ob die erste Zeile (Kopfzeile) unverändert ist — die App liest die Spalten anhand der Überschriften.

---

## Update einspielen (nur auf Anweisung)

Wenn Jörg aktualisierte Daten schickt:

```bash
# Im brunsviga/-Ordner:
bash encrypt.sh          # neu verschlüsseln (Passwort eingeben)
git add docs/
git commit -m "Update: neue Daten importiert"
git push
```

GitHub Pages aktualisiert sich dann automatisch (~1 Minute).
