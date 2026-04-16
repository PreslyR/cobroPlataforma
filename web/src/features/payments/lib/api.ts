import {
  CreatedPaymentResponse,
  PaymentOperationType,
  PaymentSimulationResponse,
} from "@/features/payments/types";
import { fetchBackendFromBrowser } from "@/shared/lib/api/browser-backend";

type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export async function simulatePayment(params: {
  loanId: string;
  amount: number;
  paymentDate: string;
  operationType: PaymentOperationType;
  mode?: "FULL_MONTH" | "PRORATED_BY_DAYS";
}): Promise<Result<PaymentSimulationResponse>> {
  const searchParams = new URLSearchParams({
    amount: String(params.amount),
    paymentDate: params.paymentDate,
    isEarlySettlement: String(params.operationType === "EARLY_SETTLEMENT"),
  });

  if (params.mode) {
    searchParams.set("mode", params.mode);
  }

  try {
    const response = await fetchBackendFromBrowser(
      `/payments/simulate/${params.loanId}?${searchParams.toString()}`,
      {
        method: "GET",
      },
    );

    if (!response.ok) {
      const message = await readErrorMessage(response);
      return { ok: false, error: message };
    }

    return {
      ok: true,
      data: (await response.json()) as PaymentSimulationResponse,
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "No se pudo conectar con el backend.",
    };
  }
}

export async function createPayment(payload: {
  loanId: string;
  clientId: string;
  totalAmount: number;
  paymentDate: string;
  isEarlySettlement: boolean;
  earlySettlementInterestModeOverride?: "FULL_MONTH" | "PRORATED_BY_DAYS";
}): Promise<Result<CreatedPaymentResponse>> {
  try {
    const response = await fetchBackendFromBrowser("/payments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const message = await readErrorMessage(response);
      return { ok: false, error: message };
    }

    return {
      ok: true,
      data: (await response.json()) as CreatedPaymentResponse,
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "No se pudo conectar con el backend.",
    };
  }
}

async function readErrorMessage(response: Response) {
  try {
    const data = (await response.json()) as { message?: string | string[] };
    const message = Array.isArray(data.message)
      ? data.message.join(", ")
      : data.message;

    return message || `El backend respondio con ${response.status}.`;
  } catch {
    return `El backend respondio con ${response.status}.`;
  }
}
