export type PortfolioOperationalStatus = "DUE_TODAY" | "OVERDUE" | "CURRENT";

export type PortfolioLoanItem = {
  loanId: string;
  lenderId: string;
  clientId: string;
  clientName: string;
  type: "FIXED_INSTALLMENTS" | "MONTHLY_INTEREST";
  operationalStatus: PortfolioOperationalStatus;
  totalCollectibleToday: number;
  outstandingBalance: number;
  dueTodayAmount: number;
  overdueAmount: number;
  penaltyPending: number;
  daysLate: number | null;
  oldestDueDate: string | null;
};

export type PortfolioResponse = {
  date: string;
  lenderId: string | null;
  filters: {
    status: PortfolioOperationalStatus | "ALL";
    type: "FIXED_INSTALLMENTS" | "MONTHLY_INTEREST" | "ALL";
    search: string;
  };
  summary: {
    activeLoans: number;
    dueTodayLoans: number;
    overdueLoans: number;
    currentLoans: number;
    visibleLoans: number;
  };
  count: number;
  items: PortfolioLoanItem[];
};
