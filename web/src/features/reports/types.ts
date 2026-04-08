export type ReportInterestIncomeResponse = {
  from: string;
  to: string;
  lenderId: string | null;
  paymentsCount: number;
  totalCollectedAmount: number;
  totalInterestIncome: number;
};

export type ReportPenaltyIncomeResponse = {
  from: string;
  to: string;
  lenderId: string | null;
  paymentsCount: number;
  totalCollectedAmount: number;
  totalPenaltyIncome: number;
};

export type ReportPortfolioSummaryResponse = {
  asOfDate: string;
  lenderId: string | null;
  totals: {
    activeLoans: number;
    dueTodayLoans: number;
    overdueLoans: number;
    principalPlaced: number;
    capitalPending: number;
    outstandingBalance: number;
    interestPending: number;
    penaltyPending: number;
    pendingTotal: number;
    dueTodayAmount: number;
    overdueAmount: number;
    totalCollectibleToday: number;
  };
};

export type ReportPaymentsHistoryResponse = {
  from: string;
  to: string;
  lenderId: string | null;
  totalCount: number;
  limit: number;
  items: Array<{
    id: string;
    loanId: string;
    clientId: string;
    clientName: string;
    loanType: "FIXED_INSTALLMENTS" | "MONTHLY_INTEREST" | "DAILY_INTEREST";
    loanStatus: string;
    totalAmount: number;
    appliedToInterest: number;
    appliedToPrincipal: number;
    appliedToPenalty: number;
    paymentDate: string;
    createdAt: string;
    isEarlySettlement: boolean;
    earlySettlementInterestModeUsed: "FULL_MONTH" | "PRORATED_BY_DAYS" | null;
    interestDaysCharged: number | null;
  }>;
};

export type ReportClosedLoansResponse = {
  from: string;
  to: string;
  lenderId: string | null;
  totalCount: number;
  limit: number;
  items: Array<{
    loanId: string;
    clientId: string;
    clientName: string;
    loanType: "FIXED_INSTALLMENTS" | "MONTHLY_INTEREST" | "DAILY_INTEREST";
    principalAmount: number;
    startDate: string;
    expectedEndDate: string | null;
    closedAt: string;
    finalPaymentAmount: number;
    finalAppliedToInterest: number;
    finalAppliedToPrincipal: number;
    finalAppliedToPenalty: number;
    wasEarlySettlement: boolean;
  }>;
};

export type ReportsPageData = {
  interestIncome: ReportInterestIncomeResponse;
  penaltyIncome: ReportPenaltyIncomeResponse;
  portfolioSummary: ReportPortfolioSummaryResponse;
  paymentsHistory: ReportPaymentsHistoryResponse;
  closedLoans: ReportClosedLoansResponse;
};
