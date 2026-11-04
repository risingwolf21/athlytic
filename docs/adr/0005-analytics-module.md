# ADR 0005 – Pure analytics module with robust statistics

**Status**: accepted

**Decision**: All calculations live in `src/analytics`, free of UI and I/O. Baselines use median/MAD, comparisons use
effect size plus coverage thresholds, correlations are Spearman with significance and sample-size limits. Insights
carry formula id, confidence and evidence points. Correlations are never presented as causes.

**Consequences**: Testable, auditable, resistant to outliers; fewer but more trustworthy insights.
