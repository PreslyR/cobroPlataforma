export type ClientOperationalStatus = "OVERDUE" | "DUE_TODAY" | "CURRENT";

export type ClientsPortfolioResponse = {
  asOfDate: string;
  lenderId: string | null;
  search: string;
  summary: {
    clientsWithActiveLoans: number;
    clientsWithOverdueLoans: number;
    totalCollectibleToday: number;
  };
  count: number;
  items: Array<{
    clientId: string;
    lenderId: string;
    fullName: string;
    documentNumber: string;
    phone: string | null;
    activeLoansCount: number;
    overdueLoansCount: number;
    totalCollectibleToday: number;
    outstandingBalance: number;
    penaltyPending: number;
    dueTodayAmount: number;
    overdueAmount: number;
    oldestDueDate: string | null;
    daysLate: number | null;
    operationalStatus: ClientOperationalStatus;
  }>;
};

export type ClientDebtResponse = {
  client: {
    id: string;
    lenderId: string;
    fullName: string;
    documentNumber: string;
    phone: string | null;
    address: string | null;
    notes: string | null;
    isActive: boolean;
    lender: {
      id: string;
      name: string;
    };
  };
  asOfDate: string;
  summary: {
    activeLoansCount: number;
    closedLoansCount: number;
    overdueLoansCount: number;
    totalCollectibleToday: number;
    outstandingBalance: number;
    penaltyPending: number;
    dueTodayAmount: number;
    overdueAmount: number;
  };
  activeLoans: Array<{
    loanId: string;
    type: "FIXED_INSTALLMENTS" | "MONTHLY_INTEREST" | "DAILY_INTEREST";
    status: string;
    totalCollectibleToday: number;
    outstandingBalance: number;
    dueTodayAmount: number;
    overdueAmount: number;
    penaltyPending: number;
    daysLate: number | null;
    oldestDueDate: string | null;
  }>;
  closedLoans: Array<{
    loanId: string;
    type: "FIXED_INSTALLMENTS" | "MONTHLY_INTEREST" | "DAILY_INTEREST";
    status: string;
    principalAmount: number;
    currentPrincipal: number;
    startDate: string;
    expectedEndDate: string | null;
    closedAt: string;
    lastPaymentAmount: number;
    wasEarlySettlement: boolean;
  }>;
  recentPayments: Array<{
    id: string;
    loanId: string;
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
