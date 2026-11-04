# Analytics module

`src/analytics/` is pure TypeScript: no React, no network, no browser APIs. Everything is a function of its input
series, so it is independently testable (tests are deferred for now, but nothing needs mocking).
`src/analytics/formulas.ts` (`FORMULAS`) is the single source of truth for formula text and shown on the in-app
*Methoden* page; this document mirrors it.

## Principles

- **Measured vs. calculated**: every metric and insight carries a `ValueKind`. `measured` values come from the
  device; `calculated` values are Athlytic estimates and are labelled as such in the UI (`KindBadge`).
- **Missing data is missing**: gaps are `null`, never `0`. Every statistic reports coverage and refuses to produce a
  result below its minimum (e.g. baselines need ≥ 10 values).
- **Configurable windows**: baseline length, trend window, correlation window and thresholds are options with
  documented defaults (`DEFAULT_BASELINE`, `DEFAULT_INSIGHT_OPTIONS`).
- **No duplicated calculation in the UI**: components call the module and only format results.
- **Traceable insights**: each `Insight` has a `formula` id, a `confidence` and `evidence[]` – the exact data
  points (metric, role, date range) used. The insight detail page renders them.
- **Correlation is not causation**: correlation insights use tentative wording ("tendenziell", "in deinen Daten")
  and never claim a cause; sample size and strength determine the confidence label.

## Formulas

| Id | Kind | Definition |
| --- | --- | --- |
| `baseline` | calculated | `median = median(x[d−28 … d−1])`; `σ = max(1.4826·MAD, 3 % · median)`; normal range `median ± 1.5σ`; needs ≥ 10 values. Median/MAD make it robust against outliers. |
| `deviation` | calculated | `z = (x − median)/σ`; `|z| > 1.5` → outside the personal normal range. |
| `windowComparison` | calculated | `Δ = mean(last N) − mean(N before)`; `Δ% = Δ/|mean before|`; `d = Δ / pooled SD`; a trend is reported if `|Δ%| ≥ threshold`, `|d| ≥ 0.5` and coverage ≥ 60 %. |
| `recovery` | calculated | Weighted mean over available inputs: HRV 30 % (`50 + 25·z`), resting HR 20 % (`50 − 25·z`), sleep 25 % (sleep score or `hours/8·100`), Body Battery 15 %, load balance 10 % (`60 + 1.5·balance`). Needs ≥ 40 % of the weight. This is **not** a medical score. |
| `trainingLoad` | calculated | Activity load = device value if present, else Edwards TRIMP `0.5 · Σ(minutes in zone z · z)`. Day load = Σ activity loads. |
| `acuteChronic` | calculated | `acute = EWMA₇(load)`, `chronic = EWMA₄₂(load)`, `balance = chronic − acute`, `ratio = acute/chronic`. |
| `lagCorrelation` | calculated | Spearman ρ between `x[d]` and `y[d+lag]` over complete day pairs (≥ 21); p-value via Fisher `z = atanh(ρ)·√(n−3)`; reported if `|ρ| ≥ 0.3` and `p ≤ 0.01`. |
| `sleepDebt` | calculated | `debtₙ = max(0, need − sleep)` per night, `need` = Garmin's adjusted sleep need (else the baseline). Insight if ≥ 4 of the last 7 nights have debt and the mean is ≥ 45 min. |
| `intensityDistribution` | calculated | Share of time in HR zones 1–2 (easy), 3 (moderate) and 4–5 (hard) over the last 28 days; needs ≥ 3 activities with zone data and ≥ 2 h. |
| `illnessPattern` | calculated | `zₛ = ±(x − median₂₈)/σ₂₈` for resting HR (+), HRV (−), respiration (+), SpO₂ (−). Day flagged if ≥ 2 signals have `zₛ ≥ 1.5` and one has `zₛ ≥ 2`. Pattern (and insight) if flagged on ≥ 2 consecutive days. See below. |
| `personalRecord` | measured | Best single-activity or single-day value over all imported data (duplicates excluded). |

## Illness early-warning pattern

Heuristic, not a diagnosis. Evidence summary (also shown in the app on the Recovery page):

- Lab challenge studies (JAMA Netw Open 2021; J Infect Dis 2023): 88–94 % of infected participants detected from resting HR, HRV and activity, ~1 day before symptoms; small groups (18–31).
- COVID-19 review (Lancet Digit Health 2022): AUC 0.52–0.92, 20–88 % of cases flagged presymptomatically; heart rate was the most frequent signal, then skin temperature and respiration.
- Personal-baseline deviations and a ≥ 2-day persistence rule reduce false alarms (Fitbit-based study, 2026).
- Real world (JMIR Form Res 2024, 470 health-care workers): ~2 % false alarms per day but only 4–10 % of alerts were infections; hard training, poor sleep, stress and alcohol move the same signals.

Design consequences: personal baselines instead of fixed limits; several signals at once; persistence over days; alerts list other plausible explanations (high acute/chronic load, sleep debt, high stress); wording never claims illness. Susceptibility to infections cannot be predicted from this data; past "episodes" are not validated because the app has no illness labels. Skin temperature would be a useful extra signal but the Garmin Personal API does not provide it (see `docs/GARMIN.md`).

## Files

| File | Responsibility |
| --- | --- |
| `metrics.ts` | Metric registry: key, unit, polarity, kind, source column. |
| `daily.ts` | Builds the day series (merging sources, handling gaps). |
| `stats.ts` | mean, median, MAD, SD, quantiles, Spearman, Fisher p-value. |
| `baseline.ts` | Personal baselines and deviations. |
| `trend.ts` | Window comparisons and trend classification. |
| `aggregate.ts` | Week / month / year aggregation with coverage. |
| `load.ts` | TRIMP, EWMA acute/chronic load. |
| `recovery.ts` | Recovery score and its weakest factor. |
| `correlation.ts` | Lagged correlations. |
| `records.ts` | Personal records. |
| `insights.ts` | Insight generation from the above, with evidence and confidence. |
| `illness.ts` | Multi-signal early-warning pattern and past episodes. |
| `formulas.ts` | Formula documentation for the UI. |

## Adding a metric or insight

1. Add the metric to `metrics.ts` (unit, polarity, kind).
2. If it is calculated, add/extend a formula in `formulas.ts` and this document.
3. Add German message templates to `src/i18n/locales/de-content.ts` under `insights.<messageKey>`.
4. Run `npm run check:i18n`.

## Today in detail (`src/analytics/today.ts`)

Metric pages show the latest day's actual data (intraday curves, sleep stages, stress bands) next to a **28-day average of the preceding days** (`windowAverage`; the day itself is excluded, shown only with at least 5 values). The difference is `value − average`. The dashboard Body Battery tile shows the **latest intraday reading** (`intradayStats`), not the daily maximum; its freshness equals the last sync.
