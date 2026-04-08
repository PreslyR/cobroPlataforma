export type DashboardDueTodayItem = {
  loanId: string;
  lenderId: string;
  clientId: string;
  clientName: string;
  type: "FIXED_INSTALLMENTS" | "DAILY_INTEREST" | "MONTHLY_INTEREST";
  dueTodayAmount: number;
  overdueAmount: number;
  penaltyPending: number;
  totalCollectibleToday: number;
  outstandingBalance: number;
};

export type DashboardOverdueItem = {
  loanId: string;
  lenderId: string;
  clientId: string;
  clientName: string;
  type: "FIXED_INSTALLMENTS" | "DAILY_INTEREST" | "MONTHLY_INTEREST";
  overdueAmount: number;
  penaltyPending: number;
  totalCollectibleToday: number;
  oldestDueDate: string;
  daysLate: number;
};

export type DashboardTodayResponse = {
  date: string;
  lenderId: string | null;
  lenderName: string | null;
  summary: {
    activeLoans: number;
    dueTodayLoans: number;
    overdueLoans: number;
    totalCollectibleToday: number;
    dueTodayAmount: number;
    overdueAmount: number;
    outstandingBalance: number;
    interestPending: number;
    penaltyPending: number;
    monthInterestIncome: number;
    monthCollectedAmount: number;
    todayPaymentsCount: number;
    todayCollectedAmount: number;
    todayInterestCollected: number;
    todayPenaltyCollected: number;
    todayPrincipalCollected: number;
  };
  sections: {
    dueToday: DashboardDueTodayItem[];
    overdue: DashboardOverdueItem[];
  };
};
