export type LoanDetailRecord = {
  id: string;
  lenderId: string;
  clientId: string;
  type: "FIXED_INSTALLMENTS" | "MONTHLY_INTEREST" | "DAILY_INTEREST";
  status: string;
  principalAmount: number;
  currentPrincipal: number;
  monthlyInterestRate: number | null;
  installmentAmount: number | null;
  totalInstallments: number | null;
  paymentFrequency: "DAILY" | "WEEKLY" | "BIWEEKLY" | "MONTHLY";
  earlySettlementInterestMode: "FULL_MONTH" | "PRORATED_BY_DAYS" | null;
  startDate: string;
  expectedEndDate: string | null;
  lender: {
    id: string;
    name: string;
  };
  client: {
    id: string;
    fullName: string;
    documentNumber: string;
  };
  installments: Array<{
    id: string;
    installmentNumber: number;
    dueDate: string;
    amount: number;
    status: "PENDING" | "LATE" | "PAID";
  }>;
  payments: Array<{
    id: string;
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

export type LoanSummaryResponse = {
  loan: {
    id: string;
    type: string;
    status: string;
    startDate: string;
    expectedEndDate: string | null;
  };
  capital: {
    principalAmount: number;
    currentPrincipal: number;
    totalPaid: number;
  };
  interest: {
    totalGenerated: number;
    totalPaid: number;
    totalPending: number;
  };
  penalty: {
    totalAmount: number;
    totalCharged: number;
    totalPending: number;
  };
  payments: {
    totalAmount: number;
    appliedToInterest: number;
    appliedToPrincipal: number;
    appliedToPenalty: number;
    count: number;
  };
  profit: {
    netProfit: number;
  };
};

export type LoanDebtBreakdownResponse = {
  loan: {
    id: string;
    lenderId: string;
    clientId: string;
    type: "FIXED_INSTALLMENTS" | "MONTHLY_INTEREST" | "DAILY_INTEREST";
    status: string;
    principalAmount: number;
    currentPrincipal: number;
    monthlyInterestRate: number | null;
    installmentAmount: number | null;
    totalInstallments: number | null;
    paymentFrequency: "DAILY" | "WEEKLY" | "BIWEEKLY" | "MONTHLY";
    earlySettlementInterestMode: "FULL_MONTH" | "PRORATED_BY_DAYS" | null;
    startDate: string;
    expectedEndDate: string | null;
    client: {
      fullName: string;
    };
    clientName: string;
  };
  asOfDate: string;
  penalty: {
    pending: number;
    pendingCount: number;
    oldestPendingDueDate: string | null;
  };
  interest: {
    totalGenerated: number;
    totalPaid: number;
    totalPending: number;
    overduePending: number;
    dueTodayPending: number;
    currentPeriod: {
      id: string;
      periodStartDate: string;
      periodEndDate: string;
      interestAmount: number;
      interestPaid: number;
      interestPending: number;
    } | null;
  };
  installments: {
    totalPending: number;
    dueTodayAmount: number;
    overdueAmount: number;
    dueTodayCount: number;
    overdueCount: number;
  };
  outstandingBalance: number;
  dueTodayAmount: number;
  overdueAmount: number;
  totalCollectibleToday: number;
  dueToday: boolean;
  overdue: boolean;
  oldestDueDate: string | null;
  daysLate: number;
};

export type LoanPayoffPreviewResponse = {
  loan: {
    id: string;
    type: "FIXED_INSTALLMENTS" | "MONTHLY_INTEREST" | "DAILY_INTEREST";
    status: string;
  };
  paymentDate: string;
  modeUsed: "FULL_MONTH" | "PRORATED_BY_DAYS" | null;
  penaltyPending: number;
  principalPending: number;
  interestPending?: number;
  overdueInterestPending?: number;
  dueTodayInterestPending?: number;
  currentPeriodInterestForPayoff?: number;
  interestDaysCharged?: number | null;
  totalPayoff: number;
};

export type LoanDetailPageData = {
  loan: LoanDetailRecord;
  summary: LoanSummaryResponse;
  debtBreakdown: LoanDebtBreakdownResponse;
  payoffFullMonth: LoanPayoffPreviewResponse;
  payoffProrated: LoanPayoffPreviewResponse | null;
};
