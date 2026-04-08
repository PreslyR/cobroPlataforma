export type ActiveClientOption = {
  id: string;
  fullName: string;
  documentNumber: string;
  phone: string | null;
};

export type CreateLoanResponse = {
  id: string;
  lenderId: string;
  clientId: string;
  type: "FIXED_INSTALLMENTS" | "MONTHLY_INTEREST" | "DAILY_INTEREST";
  principalAmount: number;
  currentPrincipal: number;
  monthlyInterestRate: number | null;
  installmentAmount: number | null;
  totalInstallments: number | null;
  paymentFrequency: "DAILY" | "WEEKLY" | "BIWEEKLY" | "MONTHLY";
  earlySettlementInterestMode: "FULL_MONTH" | "PRORATED_BY_DAYS";
  startDate: string;
  expectedEndDate: string | null;
  status: string;
  client: {
    id: string;
    fullName: string;
    documentNumber: string;
  };
  lender: {
    id: string;
    name: string;
  };
};
