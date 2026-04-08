export type PaymentOperationType = "REGULAR_PAYMENT" | "EARLY_SETTLEMENT";

export type PaymentSimulationResponse = {
  paymentDate: string;
  operationType: PaymentOperationType;
  modeUsed: "FULL_MONTH" | "PRORATED_BY_DAYS" | null;
  isAmountSufficient: boolean;
  requiredToClose: number | null;
  interestDaysCharged: number | null;
  payoff?: {
    penaltyPending: number;
    overdueInterestPending: number;
    currentPeriodInterestForPayoff: number;
    principalPending: number;
    totalPayoff: number;
  };
  distribution: {
    totalAmount: number;
    appliedToPenalty: number;
    appliedToInterest: number;
    appliedToPrincipal: number;
    remaining: number;
  };
  wouldCloseLoan: boolean;
};

export type CreatedPaymentResponse = {
  payment: {
    id: string;
    loanId: string;
    clientId: string;
    totalAmount: number;
    appliedToInterest: number;
    appliedToPrincipal: number;
    appliedToPenalty: number;
    paymentDate: string;
    isEarlySettlement: boolean;
    earlySettlementInterestModeUsed: "FULL_MONTH" | "PRORATED_BY_DAYS" | null;
    interestDaysCharged: number | null;
    loan: {
      id: string;
      currentPrincipal: number;
      status: string;
    };
    client: {
      id: string;
      fullName: string;
    };
  };
  distribution: {
    totalAmount: number;
    appliedToPenalty: number;
    appliedToInterest: number;
    appliedToPrincipal: number;
    remaining: number;
  };
  loanStatus: {
    currentPrincipal: number;
    isPaid: boolean;
  };
};
