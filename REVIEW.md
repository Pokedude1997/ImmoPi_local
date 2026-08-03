# Code Review Report

- **Status:** FAILED
- **Datum/Zeit:** 2025-08-03T07:41:00Z

## Gefundene Probleme & Bugs

### 1. **Start/Stop Scripts sind unvollständig**

1. **[Schweregrad: Hoch]** scripts/start_prod.sh:8-15 - Skript startet nur Backend, nicht Frontend
   - *Problem:* Das Skript `start_prod.sh` startet nur den Express-Backend-Server (`node server/server.js`) auf Port 8000, aber nicht den Vite-Frontend-Dev-Server auf Port 3000. Der Benutzer kann daher das Frontend nicht erreichen.
   - *Empfohlener Fix:* Skript muss ebenfalls `npm run dev > frontend.log 2>&1 &` in den Hintergrund starten, ähnlich wie die älteren Skripte (`start_immopi.sh`, `run_immopi_final.sh`) es tun.

2. **[Schweregrad: Hoch]** scripts/start_test.sh:8-15 - Skript startet nur Backend, nicht Frontend
   - *Problem:* Das Skript `start_test.sh` startet nur den Express-Backend-Server (`node server/server.js`) auf Port 8001, aber nicht den Vite-Frontend-Dev-Server. Gleiches Problem wie bei start_prod.sh.
   - *Empfohlener Fix:* Auch hier muss der Frontend-Dev-Server gestartet werden. Das Frontend sollte sich mit Port 8001 verbinden (Test-Backend).

3. **[Schweregrad: Hoch]** scripts/stop_prod.sh:9 - Stop-Skript kills nur Backend-Prozess
   - *Problem:* Das Skript killt nur den Backend-Prozess (`pkill -f "NODE_ENV=production.*node server/server.js"`), aber nicht den Frontend-Prozess (Vite dev server). Dies führt zu orphaned Frontend-Prozessen.
   - *Empfohlener Fix:* Skript muss auch den Frontend-Prozess killen, z.B. mit `pkill -f "vite"` oder speichern der PIDs beim Start.

4. **[Schweregrad: Hoch]** scripts/stop_test.sh:9 - Stop-Skript kills nur Backend-Prozess
   - *Problem:* Gleiches Problem wie bei stop_prod.sh - nur Backend wird gestoppt.
   - *Empfohlener Fix:* Auch Frontend-Prozess muss gestoppt werden.

### 2. **Fehlende Frontend-Unterstützung in Dual-Environment-Setup**

5. **[Schweregrad: Mittel]** TASKS.md beschreibt nur Backend-Dual-Environment
   - *Problem:* Die TASKS.md beschreibt nur die Dual-Environment-Setup für Backend-Server (Port 8000 und 8001), aber ignoriert vollständig, dass das Frontend (Vite dev server auf Port 3000) ebenfalls gestartet werden muss. Dies führt zu inkonsistenten Skripten.
   - *Empfohlener Fix:* TASKS.md sollte aktualisiert werden, um Frontend-Start/Stop in den Dual-Environment-Skripten zu berücksichtigen.

6. **[Schweregrad: Mittel]** Keine Port-Konfiguration für Frontend in Dual-Environment
   - *Problem:* Die neuen Skripte haben keine Konfiguration, um das Frontend mit dem richtigen Backend-Port (8000 für prod, 8001 für test) zu verbinden. Der Vite-Dev-Server läuft standardmäßig auf Port 3000, aber er muss wissen, welches Backend er ansprechen soll.
   - *Empfohlener Fix:* Umgebungsvariable für API-Endpoint setzen, z.B. `export VITE_API_URL=http://localhost:8000` für prod und `export VITE_API_URL=http://localhost:8001` für test.

### 3. **Fehlende Prozessverwaltung**

7. **[Schweregrad: Niedrig]** scripts/start_prod.sh und start_test.sh speichern keine PIDs
   - *Problem:* Die Start-Skripte starten Prozesse im Hintergrund (`&`) aber speichern die PIDs nicht. Die Stop-Skripte müssen dann mit `pkill -f` arbeiten, was unzuverlässig ist und auch andere Prozesse killen könnte.
   - *Empfohlener Fix:* PIDs in einer Datei speichern (z.B. `.pids/`) oder in einer Variable, die im Stop-Skript verwendet wird.

8. **[Schweregrad: Niedrig]** Keine Warnmeldung, dass Frontend nicht gestartet wurde
   - *Problem:* Die Skripte geben keine Hinweise aus, dass das Frontend manuell gestartet werden muss. Der Benutzer sieht nur "Starting Production Server..." und denkt, alles sei bereit.
   - *Empfohlener Fix:* Klare Hinweismeldungen, welche Komponenten gestartet wurden und welche nicht.

## Test-Ergebnisse

Keine automatischen Tests für die Skripte gefunden. Die Skripte müssten manuell getestet werden:
- `./scripts/start_prod.sh` - Startet nur Backend auf Port 8000
- `./scripts/start_test.sh` - Startet nur Backend auf Port 8001
- Frontend ist in beiden Fällen NICHT erreichbar unter http://localhost:3000

## Zusammenfassung

**Hauptproblem:** Die neuen Dual-Environment-Skripte in `scripts/` sind unvollständig. Sie starten nur den Backend-Server (Express) aber nicht den Frontend-Server (Vite dev server). Dies erklärt warum der Benutzer das Frontend nicht erreichen kann.

**Lösung:** Die Skripte müssen aktualisiert werden, um:
1. Den Vite-Frontend-Dev-Server (`npm run dev`) zusammen mit dem Backend zu starten
2. Frontend-PIDs zu verwalten und im Stop-Skript zu beenden
3. Die richtige Backend-URL dem Frontend zur Verfügung zu stellen
4. Klare Statusmeldungen anzuzeigen

**Vergleich mit funktionierenden Skripten:** Die älteren Skripte in der Root (`start_immopi.sh`, `run_immopi.sh`, `run_immopi_final.sh`) machen es richtig - sie starten beide Server (Backend + Frontend) und verwalten die PIDs korrekt.
