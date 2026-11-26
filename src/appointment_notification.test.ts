import { strict as assert } from "node:assert";
import { scheduleAppointmentNotification } from "./appointment_notification.ts";

const calls: Array<{ method: string; path: string }> = [];
const client = {
  async request<T>(method: string, path: string): Promise<T> {
    calls.push({ method, path });
    return (path.includes("get_value") ? { default_value: false } : { job_id: "job-1" }) as T;
  }
};

const result = await scheduleAppointmentNotification({
  patientId: "patient-1",
  appointmentId: "appointment-1",
  flagKey: "checkout-reminders",
  reminderUrl: "https://clinic.example/tasks/reminder"
}, client);

assert.deepEqual(result, { appointmentId: "appointment-1", status: "held", reason: "rollout-disabled" });
assert.deepEqual(calls, [{ method: "GET", path: "/v1/flags/get_value/checkout-reminders" }]);
console.log("appointment decision test passed");
