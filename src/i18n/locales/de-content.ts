/** Metric labels/descriptions, insight messages and method documentation (German). */

const metric = (label: string, description: string) => ({ label, description })

export const metrics = {
  steps: metric('Schritte', 'Gezählte Schritte pro Tag, gemessen am Handgelenk.'),
  restingHr: metric('Ruhepuls', 'Niedrigster stabiler Herzschlag des Tages, meist in der Nacht gemessen.'),
  hrv: metric('HRV', 'Herzfrequenzvariabilität im Schlaf (RMSSD, Nachtdurchschnitt). Höher bedeutet meist bessere Erholung.'),
  sleepHours: metric('Schlafdauer', 'Gesamte Schlafzeit der Nacht ohne Wachphasen.'),
  sleepScore: metric('Schlaf-Score', 'Von der Uhr berechnete Schlafbewertung von 0 bis 100.'),
  deepSleepPct: metric('Tiefschlaf-Anteil', 'Anteil des Tiefschlafs an der gesamten Schlafzeit.'),
  avgStress: metric('Stress', 'Durchschnittlicher Stresswert des Tages, abgeleitet aus der Herzfrequenzvariabilität.'),
  bodyBatteryHigh: metric('Body Battery (Maximum)', 'Höchster Energiewert des Tages, meist nach dem Aufwachen.'),
  bodyBatteryLow: metric('Body Battery (Minimum)', 'Niedrigster Energiewert des Tages.'),
  intensityMinutes: metric('Intensitätsminuten', 'Minuten mit moderater oder intensiver Belastung.'),
  floors: metric('Etagen', 'Gestiegene Stockwerke, aus dem barometrischen Höhenmesser abgeleitet.'),
  activeKcal: metric('Aktive Kalorien', 'Kalorienverbrauch durch Bewegung ohne Grundumsatz.'),
  vo2Max: metric('VO₂max', 'Von der Uhr geschätzte maximale Sauerstoffaufnahme. Eine Schätzung, kein Labortest.'),
  trainingLoad: metric('Trainingsbelastung', 'Summe der Belastung aller Aktivitäten des Tages.'),
  acuteLoad: metric('Akute Last', 'Gewichteter Durchschnitt der Belastung der letzten etwa 7 Tage.'),
  chronicLoad: metric('Chronische Last', 'Gewichteter Durchschnitt der Belastung der letzten etwa 42 Tage.'),
  loadBalance: metric('Lastbalance', 'Chronische minus akute Last. Negativ heißt: zuletzt mehr als gewohnt trainiert.'),
  recovery: metric('Erholung', 'Geschätzter Erholungswert aus HRV, Ruhepuls, Schlaf, Body Battery und Lastbalance.'),
  distanceKm: metric('Distanz', 'Zurückgelegte Strecke aller Aktivitäten.'),
  durationMin: metric('Trainingszeit', 'Dauer aller Aktivitäten.'),
  elevationGainM: metric('Höhenmeter', 'Aufgestiegene Höhenmeter aller Aktivitäten.'),
  spo2Avg: metric('Blutsauerstoff (SpO₂)', 'Durchschnittliche Sauerstoffsättigung des Tages. Werte um 95–100 % gelten bei Gesunden als normal; die Messung am Handgelenk ist ungenau und kein medizinischer Wert.'),
  respirationAvg: metric('Atemfrequenz', 'Durchschnittliche Atemzüge pro Minute im Wachzustand, aus Herzschlagdaten abgeleitet.'),
  hydrationMl: metric('Flüssigkeit', 'Manuell oder per Uhr eingetragene Trinkmenge des Tages.'),
  highStressMin: metric('Hoher Stress', 'Minuten des Tages im Stressbereich „hoch“ laut Uhr.'),
  sleepDebtMin: metric('Schlafdefizit', 'Differenz zwischen dem von der Uhr geschätzten Schlafbedarf und der tatsächlichen Schlafzeit. Ein Wert von 0 heißt: Bedarf gedeckt.'),
  sleepStress: metric('Stress im Schlaf', 'Durchschnittlicher Stresswert während des Schlafs. Niedriger ist besser.'),
  weightKg: metric('Gewicht', 'Gewicht aus Waage oder manueller Eingabe. Tagesschwankungen von 1–2 kg sind normal.'),
  bodyFatPct: metric('Körperfett', 'Körperfettanteil laut Waage. Waagen messen per Bioimpedanz und schwanken je nach Flüssigkeitshaushalt.'),
}

export const records = {
  longestDistance: 'Längste Distanz',
  longestDuration: 'Längste Aktivität',
  mostElevation: 'Meiste Höhenmeter',
  fastestAvgSpeed: 'Höchstes Durchschnittstempo',
  highestTrainingLoad: 'Höchste Trainingsbelastung',
  mostSteps: 'Meiste Schritte an einem Tag',
  bestSleepScore: 'Bester Schlaf-Score',
  highestHrv: 'Höchste HRV',
  lowestRestingHr: 'Niedrigster Ruhepuls',
}

const msg = (title: string, body: string) => ({ title, body })

export const insightMessages = {
  deviation: {
    up: msg(
      '{{metric}} über deinem Normalbereich',
      'Dein Wert von {{value}} {{unit}} liegt über deinem persönlichen Normalbereich von {{low}} bis {{high}} {{unit}} (Median {{median}} {{unit}}, aus {{days}} Messtagen). Abstand zur Streuung: z = {{z}}.',
    ),
    down: msg(
      '{{metric}} unter deinem Normalbereich',
      'Dein Wert von {{value}} {{unit}} liegt unter deinem persönlichen Normalbereich von {{low}} bis {{high}} {{unit}} (Median {{median}} {{unit}}, aus {{days}} Messtagen). Abstand zur Streuung: z = {{z}}.',
    ),
  },
  trend: {
    up: msg(
      '{{metric}} steigt',
      'In den letzten {{days}} Tagen lag der Durchschnitt bei {{current}} {{unit}}, in den {{days}} Tagen davor bei {{previous}} {{unit}} ({{deltaText}} {{unit}}, {{percentText}}). Effektstärke d = {{effect}}.',
    ),
    down: msg(
      '{{metric}} sinkt',
      'In den letzten {{days}} Tagen lag der Durchschnitt bei {{current}} {{unit}}, in den {{days}} Tagen davor bei {{previous}} {{unit}} ({{deltaText}} {{unit}}, {{percentText}}). Effektstärke d = {{effect}}.',
    ),
  },
  correlation: {
    positive: msg(
      '{{x}} und {{y}}: {{strengthText}} Zusammenhang',
      'Höhere Werte bei {{x}} gingen in deinen Daten tendenziell mit höheren Werten bei {{y}} einher ({{lagText}}). Rangkorrelation ρ = {{rho}}, {{pairs}} Wertepaare, p = {{p}}.',
    ),
    negative: msg(
      '{{x}} und {{y}}: {{strengthText}} gegenläufiger Zusammenhang',
      'Höhere Werte bei {{x}} gingen in deinen Daten tendenziell mit niedrigeren Werten bei {{y}} einher ({{lagText}}). Rangkorrelation ρ = {{rho}}, {{pairs}} Wertepaare, p = {{p}}.',
    ),
  },
  load: {
    high: msg(
      'Trainingslast deutlich erhöht',
      'Deine akute Last ({{acute}}) liegt beim {{ratio}}-Fachen deiner chronischen Last ({{chronic}}). Du hast zuletzt deutlich mehr trainiert, als dein Körper gewohnt ist.',
    ),
    low: msg(
      'Trainingslast niedriger als gewohnt',
      'Deine akute Last ({{acute}}) liegt nur beim {{ratio}}-Fachen deiner chronischen Last ({{chronic}}). Du hast zuletzt deutlich weniger trainiert als üblich.',
    ),
  },
  recovery: {
    high: msg(
      'Gute Erholung: {{score}} von 100',
      'Dein geschätzter Erholungswert ist hoch. Berücksichtigt wurden {{completeness}} % der möglichen Eingangsdaten.',
    ),
    low: msg(
      'Erholung niedrig: {{score}} von 100',
      'Dein geschätzter Erholungswert ist niedrig. Am schwächsten fiel {{weakestText}} aus. Berücksichtigt wurden {{completeness}} % der möglichen Eingangsdaten.',
    ),
  },
  sleep: {
    debt: msg(
      'Schlafdefizit in dieser Woche',
      'In {{nights}} der letzten 7 Nächte lag dein Schlaf im Schnitt {{minutes}} Minuten unter dem von der Uhr geschätzten Bedarf. Mehr Schlaf oder frühere Schlafenszeiten können das ausgleichen.',
    ),
  },
  intensity: {
    balanced: msg(
      'Ausgewogene Intensitätsverteilung',
      'In den letzten 28 Tagen ({{activities}} Aktivitäten, {{hours}} h) lagen {{easy}} % der Zeit im leichten Bereich (Zone 1–2), {{moderate}} % in Zone 3 und {{hard}} % in Zone 4–5.',
    ),
    moderate: msg(
      'Viel Training im mittleren Bereich',
      'In den letzten 28 Tagen ({{activities}} Aktivitäten, {{hours}} h) lagen {{moderate}} % der Zeit in Zone 3 und nur {{easy}} % im leichten Bereich. Viele Ausdauerplanungen setzen auf mehr leichte und einzelne wirklich harte Einheiten – ob das für dich passt, hängt von deinem Ziel ab.',
    ),
  },
  record: {
    longestDistance: msg('Neue Bestleistung: längste Distanz', '{{value}}{{sport}} – bisher {{previous}}.'),
    longestDuration: msg('Neue Bestleistung: längste Aktivität', '{{value}} – bisher {{previous}}.'),
    mostElevation: msg('Neue Bestleistung: meiste Höhenmeter', '{{value}} – bisher {{previous}}.'),
    fastestAvgSpeed: msg('Neue Bestleistung: schnellstes Durchschnittstempo', '{{value}} – bisher {{previous}}.'),
    highestTrainingLoad: msg('Neue Bestleistung: höchste Trainingsbelastung', '{{value}} – bisher {{previous}}.'),
    mostSteps: msg('Neue Bestleistung: meiste Schritte', '{{value}} Schritte – bisher {{previous}}.'),
    bestSleepScore: msg('Neue Bestleistung: bester Schlaf-Score', '{{value}} – bisher {{previous}}.'),
    highestHrv: msg('Neue Bestleistung: höchste HRV', '{{value}} – bisher {{previous}}.'),
    lowestRestingHr: msg('Neue Bestleistung: niedrigster Ruhepuls', '{{value}} – bisher {{previous}}.'),
  },
}

const method = (name: string, description: string, limits: string) => ({ name, description, limits })

export const methods = {
  title: 'Methodik',
  subtitle: 'So entstehen die berechneten Werte und Erkenntnisse in Athlytic.',
  usedFor: 'Verwendete Messwerte',
  measuredVsCalculated: 'Gemessen oder berechnet?',
  measuredVsCalculatedBody:
    'Gemessene Werte stammen direkt von deiner Uhr oder deinem Anbieter. Berechnete Werte entstehen in Athlytic aus Messwerten und sind Schätzungen. Beides ist in der App gekennzeichnet.',
  metricCount: '{{measured}} Messgrößen, {{calculated}} berechnete Größen',
  baseline: method(
    'Persönliche Baseline',
    'Der Normalbereich eines Werts wird aus deinen letzten 28 Tagen bestimmt: Median plus ein robustes Streuungsmaß (MAD). Ausreißer verzerren ihn dadurch kaum.',
    'Benötigt mindestens 10 Messwerte. Bei weniger Daten wird kein Normalbereich angezeigt.',
  ),
  deviation: method(
    'Abweichung von der Baseline',
    'Zeigt, wie weit ein Wert vom Median deiner Baseline entfernt ist, gemessen in Streuungseinheiten (z-Wert). Außerhalb von ±1,5 gilt er als ungewöhnlich.',
    'Ungewöhnlich heißt nicht schlecht. Krankheit, Reisen, Alkohol oder Training können Werte verschieben.',
  ),
  windowComparison: method(
    'Zeitraumvergleich',
    'Vergleicht den Durchschnitt der letzten N Tage mit den N Tagen davor. Ein Trend wird nur gemeldet, wenn die Änderung groß genug ist, die Effektstärke mindestens 0,5 beträgt und 60 % der Tage Daten haben.',
    'Kurze Zeiträume schwanken natürlich. Ein einzelner Trend ist kein Beleg für eine dauerhafte Veränderung.',
  ),
  recovery: method(
    'Erholungswert',
    'Gewichteter Mittelwert aus HRV, Ruhepuls, Schlaf, Body Battery und Lastbalance. HRV und Ruhepuls werden dabei an deiner eigenen Baseline gemessen.',
    'Eine Schätzung von Athlytic, kein medizinischer Wert und nicht der Wert eines Herstellers. Fehlen Eingangsdaten, wird neu gewichtet; unter 40 % der Gewichte wird kein Wert berechnet.',
  ),
  trainingLoad: method(
    'Trainingsbelastung',
    'Pro Aktivität wird der Wert der Uhr verwendet. Fehlt er, schätzt Athlytic die Belastung nach Edwards aus den Minuten in den Herzfrequenzzonen. Die Tagesbelastung ist die Summe.',
    'Die Schätzung berücksichtigt weder Gelände noch Wetter oder Ausrüstung und ist bei fehlenden Zonendaten ungenauer.',
  ),
  acuteChronic: method(
    'Akute und chronische Last',
    'Zwei exponentiell gewichtete Durchschnitte der Tagesbelastung: 7 Tage (akut) und 42 Tage (chronisch). Ihr Verhältnis zeigt, ob zuletzt mehr oder weniger als gewohnt trainiert wurde.',
    'Das Verhältnis ist ein Orientierungswert. Schwellen wie 1,4 sind Faustregeln und gelten nicht für jeden gleich.',
  ),
  lagCorrelation: method(
    'Zusammenhänge zwischen Werten',
    'Rangkorrelation nach Spearman zwischen zwei Messgrößen, optional mit einem Tag Versatz. Gemeldet wird nur, wenn mindestens 21 vollständige Tagespaare vorliegen, |ρ| ≥ 0,3 und p ≤ 0,01.',
    'Eine Korrelation zeigt, dass Werte gemeinsam auftreten, nicht dass einer den anderen verursacht. Dritte Faktoren wie Schlaf, Alter der Daten oder Jahreszeit können mitwirken.',
  ),
  personalRecord: method(
    'Persönliche Bestleistungen',
    'Der beste Einzelwert einer Aktivität oder eines Tages über alle importierten Daten.',
    'Gilt nur für den importierten Zeitraum. Frühere Bestleistungen vor dem Import sind nicht bekannt.',
  ),
  sleepDebt: method(
    'Schlafdefizit',
    'Pro Nacht: geschätzter Schlafbedarf der Uhr minus tatsächlich geschlafene Zeit, nie unter null. Gemeldet wird ein Defizit, wenn der Durchschnitt der letzten 7 Nächte mindestens 45 Minuten beträgt.',
    'Der Bedarf ist eine Schätzung der Uhr und berücksichtigt Training, HRV und Nickerchen. Er ist kein medizinischer Richtwert.',
  ),
  intensityDistribution: method(
    'Intensitätsverteilung',
    'Zeit in den Herzfrequenzzonen der letzten 28 Tage, zusammengefasst in leicht (Zone 1–2), mittel (Zone 3) und hart (Zone 4–5).',
    'Nur Aktivitäten mit Zonendaten zählen. Die Zonen hängen von deiner eingestellten Maximalfrequenz ab; eine ideale Verteilung gibt es nicht, sie hängt vom Trainingsziel ab.',
  ),
}
