import { FORECAST_WEEKS_PER_MONTH, STEERING_ROWS_LIMIT, normalizeKey } from "./statsUtils";

/**
 * Compute leadership KPI values from the raw stats payload.
 * Returns plain values (no JSX/format strings) so it stays unit-testable.
 */
export function computeLeadershipKpis(stats, contracts) {
  const sevdesk = stats?.sevdesk || {};
  const customerSummary = sevdesk?.customerPaymentSummary || {};
  const reports = stats?.reports || {};
  const contractsRevenue = contracts?.revenue || {};
  const contractsHours = contracts?.hours || {};
  const customerPaymentRows = Array.isArray(sevdesk?.customerPaymentStats) ? sevdesk.customerPaymentStats : [];

  const churnRiskCustomers = customerPaymentRows.filter(
    (entry) => String(entry?.grade || "").toUpperCase() === "C"
  ).length;

  const trendRevenueYear =
    Number(customerSummary.revenueCurrentYearEur || 0) -
    Number(customerSummary.revenueLastYearEur || 0);

  const trendSla =
    Number(contractsHours.deltaCurrentMonth || 0) -
    Number(contractsHours.deltaPreviousMonth || 0);

  const backendForecast = Number(sevdesk?.forecastMonthlyEur || 0);
  const forecastMonthly =
    backendForecast > 0
      ? Number(contractsRevenue.monthlyActiveTotal || 0) + backendForecast
      : Number(contractsRevenue.monthlyActiveTotal || 0) +
        Number(stats?.revenueEstimateWeekEur || 0) * FORECAST_WEEKS_PER_MONTH;

  const overdueCount = Number(sevdesk?.overdue?.count || 0);
  const overdueSum = Number(sevdesk?.overdue?.sumEur || 0);
  const slaDelta = Number(contractsHours.deltaCurrentMonth || 0);
  const reportsOpen = Number(reports.open || 0);

  return {
    revenueYtd: Number(sevdesk?.paidCurrentYear?.sumEur || 0),
    trendRevenueYear,
    mrr: Number(contractsRevenue.monthlyActiveTotal || 0),
    forecastMonthly,
    forecastSource: backendForecast > 0 ? "rolling12Weeks" : "legacyHeuristic",
    overdueCount,
    overdueSum,
    slaDelta,
    trendSla,
    churnRiskCustomers,
    reportsOpen
  };
}

export function buildAlerts(kpi) {
  const alerts = [];
  if (kpi.overdueCount > 0) alerts.push("overdue_invoices");
  if (kpi.slaDelta > 0) alerts.push("sla_overrun");
  if (kpi.reportsOpen > 0) alerts.push("reports_open");
  return alerts;
}

export function nextActionFromKpi(kpi) {
  if (kpi.slaDelta > 0) return "sla_review_top_delta";
  if (kpi.overdueCount > 0) return "overdue_followup";
  return "forecast_focus";
}

/**
 * Build the customer-steering "discussion list" from raw payment stats and
 * recurring rows. Pure function so it can be tested without React.
 */
export function buildCustomerControlRows(customerPaymentStats, recurringCustomerRows, options = {}) {
  const limit = Number(options.limit ?? STEERING_ROWS_LIMIT);
  const recurringByKey = new Map();
  (recurringCustomerRows || []).forEach((row) => {
    const keys = [
      normalizeKey(row?.contactId),
      normalizeKey(row?.customerNumber),
      normalizeKey(row?.customerName)
    ].filter(Boolean);
    keys.forEach((key) => recurringByKey.set(key, row));
  });

  return (customerPaymentStats || [])
    .map((row) => {
      const recurring =
        recurringByKey.get(normalizeKey(row?.contactId)) ||
        recurringByKey.get(normalizeKey(row?.customerNumber)) ||
        recurringByKey.get(normalizeKey(row?.name)) ||
        null;
      const budget = row?.budgetEstimate && typeof row.budgetEstimate === "object" ? row.budgetEstimate : null;
      const currentYearRevenue = Number(row?.revenueCurrentYearEur || 0);
      const lastYearRevenue = Number(row?.revenueLastYearEur || 0);
      const recurringMonthly = Number(recurring?.monthlyTotalEur || 0);
      const recurringYearly = recurringMonthly * 12;
      const budgetValue = Number(budget?.suggestedBudgetEur || 0);
      const budgetProgress = budgetValue > 0 ? Math.round((currentYearRevenue / budgetValue) * 100) : null;
      return {
        name: row?.name || recurring?.customerName || "Unbekannt",
        customerNumber: row?.customerNumber || recurring?.customerNumber || "",
        grade: row?.grade || "-",
        currentYearRevenue,
        lastYearRevenue,
        totalAmount: Number(row?.totalAmountEur || 0),
        recurringMonthly,
        recurringYearly,
        budget,
        budgetProgress,
        discussionValue: Math.max(currentYearRevenue, lastYearRevenue, recurringYearly, budgetValue),
        openOverdueAmount: Number(row?.openOverdueAmountEur || row?.openAmountEur || 0),
        businessWeight: Number(row?.businessWeight || 0)
      };
    })
    .sort((a, b) => b.discussionValue - a.discussionValue || b.businessWeight - a.businessWeight)
    .slice(0, limit);
}
