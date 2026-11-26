import { z } from "zod";
import { InfraiClient } from "./infrai_client.ts";

export const appointmentRequest = z.object({
  patientId: z.string().min(1),
  appointmentId: z.string().min(1),
  flagKey: z.string().min(1),
  reminderUrl: z.string().url()
});

const capabilityName = "flags.get_value";

type FlagValue = { value?: boolean; default_value?: boolean };
type CronResult = { job_id: string };
type InfraiRequester = Pick<InfraiClient, "request">;

export async function scheduleAppointmentNotification(input: unknown, client: InfraiRequester) {
  const request = appointmentRequest.parse(input);
  const flag = await client.request<FlagValue>("GET", `/v1/flags/get_value/${encodeURIComponent(request.flagKey)}`);
  const enabled = flag.value ?? flag.default_value ?? false;
  if (!enabled) {
    return { appointmentId: request.appointmentId, status: "held", reason: "rollout-disabled" as const };
  }
  const job = await client.request<CronResult>("POST", "/v1/cron/create", {
    cron_expr: "0 * * * *",
    task: request.reminderUrl
  });
  return { appointmentId: request.appointmentId, status: "scheduled", jobId: job.job_id };
}

export async function main() {
  const key = process.env.INFRAI_API_KEY;
  const flagKey = process.env.APPOINTMENT_FLAG_KEY;
  const reminderUrl = process.env.REMINDER_TASK_URL;
  if (!key || !flagKey || !reminderUrl) throw new Error("Set INFRAI_API_KEY, APPOINTMENT_FLAG_KEY, and REMINDER_TASK_URL");
  const result = await scheduleAppointmentNotification({
    patientId: process.env.PATIENT_ID ?? "patient-input",
    appointmentId: process.env.APPOINTMENT_ID ?? "appointment-input",
    flagKey,
    reminderUrl
  }, new InfraiClient(key));
  console.log(JSON.stringify(result));
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
