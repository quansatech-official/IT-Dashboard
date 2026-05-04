import { describe, it, expect } from "vitest";
import {
  computeLeadershipKpis,
  buildAlerts,
  nextActionFromKpi,
  buildCustomerControlRows
} from "./statsLogic";

describe("computeLeadershipKpis", () => {
  it("returns zeros for empty payload", () => {
    const kpi = computeLeadershipKpis({}, {});
    expect(kpi.revenueYtd).toBe(0);
    expect(kpi.mrr).toBe(0);
    expect(kpi.overdueCount).toBe(0);
    expect(kpi.churnRiskCustomers).toBe(0);
    expect(kpi.forecastSource).toBe("legacyHeuristic");
  });

  it("uses backend forecast when available", () => {
    const kpi = computeLeadershipKpis(
      { sevdesk: { forecastMonthlyEur: 8000 } },
      { revenue: { monthlyActiveTotal: 5000 } }
    );
    expect(kpi.forecastMonthly).toBe(13000);
    expect(kpi.forecastSource).toBe("rolling12Weeks");
  });

  it("falls back to legacy heuristic when no backend forecast", () => {
    const kpi = computeLeadershipKpis(
      { revenueEstimateWeekEur: 1000 },
      { revenue: { monthlyActiveTotal: 5000 } }
    );
    // 5000 + 1000 * 4 (FORECAST_WEEKS_PER_MONTH)
    expect(kpi.forecastMonthly).toBe(9000);
    expect(kpi.forecastSource).toBe("legacyHeuristic");
  });

  it("counts customers with grade C as churn risk", () => {
    const kpi = computeLeadershipKpis(
      {
        sevdesk: {
          customerPaymentStats: [
            { grade: "A" },
            { grade: "C" },
            { grade: "c" },
            { grade: "B" },
            { grade: null }
          ]
        }
      },
      {}
    );
    expect(kpi.churnRiskCustomers).toBe(2);
  });

  it("computes year-over-year revenue trend", () => {
    const kpi = computeLeadershipKpis(
      {
        sevdesk: {
          customerPaymentSummary: {
            revenueCurrentYearEur: 100000,
            revenueLastYearEur: 80000
          }
        }
      },
      {}
    );
    expect(kpi.trendRevenueYear).toBe(20000);
  });

  it("computes SLA delta trend", () => {
    const kpi = computeLeadershipKpis(
      {},
      {
        hours: { deltaCurrentMonth: 10, deltaPreviousMonth: 4 }
      }
    );
    expect(kpi.slaDelta).toBe(10);
    expect(kpi.trendSla).toBe(6);
  });
});

describe("buildAlerts / nextActionFromKpi", () => {
  it("emits no alerts when everything is fine", () => {
    const kpi = computeLeadershipKpis({}, {});
    expect(buildAlerts(kpi)).toEqual([]);
    expect(nextActionFromKpi(kpi)).toBe("forecast_focus");
  });

  it("prioritises SLA over overdue", () => {
    const kpi = computeLeadershipKpis(
      { sevdesk: { overdue: { count: 3, sumEur: 1500 } } },
      { hours: { deltaCurrentMonth: 5 } }
    );
    expect(buildAlerts(kpi)).toEqual(["overdue_invoices", "sla_overrun"]);
    expect(nextActionFromKpi(kpi)).toBe("sla_review_top_delta");
  });

  it("recommends overdue follow-up when no SLA issue", () => {
    const kpi = computeLeadershipKpis(
      { sevdesk: { overdue: { count: 2, sumEur: 500 } } },
      {}
    );
    expect(nextActionFromKpi(kpi)).toBe("overdue_followup");
  });
});

describe("buildCustomerControlRows", () => {
  it("returns empty list for empty input", () => {
    expect(buildCustomerControlRows([], [])).toEqual([]);
  });

  it("merges recurring data via contactId", () => {
    const rows = buildCustomerControlRows(
      [{ name: "ACME", contactId: "42", revenueCurrentYearEur: 1000 }],
      [{ contactId: "42", monthlyTotalEur: 250 }]
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].recurringMonthly).toBe(250);
    expect(rows[0].recurringYearly).toBe(3000);
  });

  it("matches by customer number when contactId missing", () => {
    const rows = buildCustomerControlRows(
      [{ name: "ACME", customerNumber: "K-001", revenueCurrentYearEur: 500 }],
      [{ customerNumber: "K-001", monthlyTotalEur: 100 }]
    );
    expect(rows[0].recurringYearly).toBe(1200);
  });

  it("computes budget progress in percent", () => {
    const rows = buildCustomerControlRows(
      [{ name: "ACME", revenueCurrentYearEur: 4500, budgetEstimate: { suggestedBudgetEur: 9000 } }],
      []
    );
    expect(rows[0].budgetProgress).toBe(50);
  });

  it("returns null budgetProgress when no budget", () => {
    const rows = buildCustomerControlRows([{ name: "ACME", revenueCurrentYearEur: 1000 }], []);
    expect(rows[0].budgetProgress).toBeNull();
  });

  it("uses max of revenues, recurring, budget as discussion value", () => {
    const rows = buildCustomerControlRows(
      [
        {
          name: "ACME",
          revenueCurrentYearEur: 2000,
          revenueLastYearEur: 5000,
          budgetEstimate: { suggestedBudgetEur: 3000 }
        }
      ],
      [{ customerName: "ACME", monthlyTotalEur: 100 }]
    );
    // last year (5000) is highest
    expect(rows[0].discussionValue).toBe(5000);
  });

  it("sorts descending by discussion value, then by business weight", () => {
    const rows = buildCustomerControlRows(
      [
        { name: "Small", revenueCurrentYearEur: 1000, businessWeight: 1 },
        { name: "Big", revenueCurrentYearEur: 10000, businessWeight: 2 },
        { name: "Heavy", revenueCurrentYearEur: 1000, businessWeight: 5 }
      ],
      []
    );
    expect(rows.map((r) => r.name)).toEqual(["Big", "Heavy", "Small"]);
  });

  it("respects limit option", () => {
    const inputs = Array.from({ length: 20 }, (_, i) => ({
      name: `Cust${i}`,
      revenueCurrentYearEur: 1000 - i
    }));
    expect(buildCustomerControlRows(inputs, [], { limit: 5 })).toHaveLength(5);
    expect(buildCustomerControlRows(inputs, [])).toHaveLength(8); // STEERING_ROWS_LIMIT
  });
});
