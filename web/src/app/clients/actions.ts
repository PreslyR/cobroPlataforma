"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { fetchBackendFromServer } from "@/shared/lib/api/server-backend";

function buildClientsRedirect(formData: FormData) {
  const date = String(formData.get("date") ?? "").trim();
  const search = String(formData.get("search") ?? "").trim();
  const tab = String(formData.get("tab") ?? "pending").trim() || "pending";
  const params = new URLSearchParams({
    tab,
  });

  if (date) {
    params.set("date", date);
  }

  if (search) {
    params.set("search", search);
  }

  return params;
}

async function extractErrorMessage(response: Response) {
  try {
    const payload = (await response.json()) as { message?: string | string[] };
    const message = payload.message;

    if (Array.isArray(message)) {
      return message.join(" ");
    }

    if (typeof message === "string" && message.trim()) {
      return message;
    }
  } catch {
    // Ignore malformed error payloads.
  }

  return `El backend respondio con ${response.status}.`;
}

export async function approveClientIntakeSubmissionAction(formData: FormData) {
  const submissionId = String(formData.get("submissionId") ?? "").trim();
  const redirectParams = buildClientsRedirect(formData);

  if (!submissionId) {
    redirectParams.set("intakeError", "No se recibio el identificador del registro.");
    redirect(`/clients?${redirectParams.toString()}`);
  }

  const response = await fetchBackendFromServer(
    `/client-intake/submissions/${submissionId}/approve`,
    {
      init: {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: "{}",
        cache: "no-store",
      },
    },
  );

  if (!response.ok) {
    redirectParams.set("intakeError", await extractErrorMessage(response));
    redirect(`/clients?${redirectParams.toString()}`);
  }

  revalidatePath("/clients");
  redirectParams.set("intakeNotice", "Cliente aprobado y creado correctamente.");
  redirect(`/clients?${redirectParams.toString()}`);
}

export async function rejectClientIntakeSubmissionAction(formData: FormData) {
  const submissionId = String(formData.get("submissionId") ?? "").trim();
  const redirectParams = buildClientsRedirect(formData);

  if (!submissionId) {
    redirectParams.set("intakeError", "No se recibio el identificador del registro.");
    redirect(`/clients?${redirectParams.toString()}`);
  }

  const response = await fetchBackendFromServer(
    `/client-intake/submissions/${submissionId}/reject`,
    {
      init: {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reason: "Rechazado desde la bandeja de pendientes.",
        }),
        cache: "no-store",
      },
    },
  );

  if (!response.ok) {
    redirectParams.set("intakeError", await extractErrorMessage(response));
    redirect(`/clients?${redirectParams.toString()}`);
  }

  revalidatePath("/clients");
  redirectParams.set("intakeNotice", "Solicitud rechazada.");
  redirect(`/clients?${redirectParams.toString()}`);
}
