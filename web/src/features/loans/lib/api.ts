import { ActiveClientOption, CreateLoanResponse } from "@/features/loans/types";

const API_BASE_URL =
  process.env.API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://localhost:3000/api";

type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; meta?: { baseUrl: string } };

export async function getActiveClients(
  lenderId: string,
): Promise<Result<ActiveClientOption[]>> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/clients?lenderId=${encodeURIComponent(lenderId)}`,
      {
        cache: "no-store",
      },
    );

    if (!response.ok) {
      return {
        ok: false,
        error: `El backend respondio con ${response.status}.`,
        meta: { baseUrl: API_BASE_URL },
      };
    }

    const rawClients = (await response.json()) as Array<{
      id: string;
      fullName: string;
      documentNumber: string;
      phone: string | null;
    }>;

    return {
      ok: true,
      data: rawClients.map((client) => ({
        id: client.id,
        fullName: client.fullName,
        documentNumber: client.documentNumber,
        phone: client.phone,
      })),
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "No se pudo conectar con el backend.",
      meta: { baseUrl: API_BASE_URL },
    };
  }
}

export async function createLoan(payload: {
  lenderId: string;
  clientId: string;
  type: "FIXED_INSTALLMENTS" | "MONTHLY_INTEREST";
  principalAmount: number;
  monthlyInterestRate?: number;
  installmentAmount?: number;
  totalInstallments?: number;
  paymentFrequency: "DAILY" | "WEEKLY" | "BIWEEKLY" | "MONTHLY";
  earlySettlementInterestMode?: "FULL_MONTH" | "PRORATED_BY_DAYS";
  startDate: string;
  expectedEndDate?: string;
}): Promise<Result<CreateLoanResponse>> {
  try {
    const response = await fetch(`${API_BASE_URL}/loans`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const message = await readErrorMessage(response);
      return {
        ok: false,
        error: message,
      };
    }

    return {
      ok: true,
      data: (await response.json()) as CreateLoanResponse,
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
