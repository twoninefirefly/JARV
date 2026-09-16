# Der Intro-Film

Hier gehört genau eine Datei hin:

    intro.mp4

Sie spielt nach der Startsequenz, zwischen der Marke im Ring und der lebenden
Oberfläche. **Sie ist optional.** Fehlt sie, startet JARVIS exakt so wie vorher —
kein Fehler, keine Wartezeit, keine schwarze Fläche. Genau dafür ist
`src/lib/film.ts` gebaut.

## Wie der Film behandelt wird

Das Video-Element hängt die ganze Sitzung über in der Seite und lädt schon
während des Zündbildschirms vor. Beim Druck auf AKTIVIEREN wird **einmal**
gefragt, ob es vollständig gepuffert ist (`readyState` 4). Nur dann läuft es
mit. Ist es noch am Laden, bleibt es diesmal weg — lieber kein Film als ein
Film, der mitten im Vorführen stockt.

Die Länge der Sequenz richtet sich nach der tatsächlichen Dauer der Datei,
gedeckelt auf 14 Sekunden. Ein Tastendruck oder Klick überspringt ihn.

## Was für eine Datei

- **H.264/MP4**, das spielt jeder Browser ab
- **16:9**, wird formatfüllend beschnitten (`object-fit: cover`)
- **Ohne Ton.** Das Element ist stumm geschaltet, weil ein unstummer Film gar
  nicht erst automatisch abspielen dürfte. Der Ton beim Start ist der
  synthetische Startklang plus die gesprochene Begrüßung.
- **Unter ~15 MB.** Darüber ist er beim ersten Aufruf nicht rechtzeitig fertig
  und wird dann eben übersprungen.

## Etwas anderes einsetzen

Jede Datei unter diesem Namen übernimmt. Im Code steht keine Länge, kein
Seitenverhältnis und kein Dateiname außerhalb von `FILM_SRC` in
`src/lib/film.ts`.
