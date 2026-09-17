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

- **H.264/MP4** ist die sichere Wahl — das spielt jeder Browser ab.
  Die Datei, die hier liegt, ist **HEVC/H.265** (so liefert Seedance sie aus).
  Chrome spielt das seit Version 105 über den Systemdecoder, auf macOS 11+ auf
  jedem Gerät. Falls der Film bei dir trotzdem nie erscheint, ist das der
  Grund: QuickTime Player öffnen, **Ablage → Exportieren als → 1080p** — das
  codiert nach H.264 um — und die Datei wieder als `intro.mp4` hier ablegen.
  Der `moov`-Block liegt am Dateiende statt am Anfang, die Datei muss also
  vollständig geladen sein, bevor sie startet. Genau deshalb wird sie
  vorgeladen und nur bei vollständiger Pufferung überhaupt eingeplant.
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
