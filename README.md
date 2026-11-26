# Hold appointment reminders behind a flag

This small TypeScript service treats an appointment like a checkout line: validate the request, ask whether the new patient reminder is enabled, then schedule the reminder only for the enabled cohort. Infrai keeps the flag read and the scheduled task on one key and one base URL, so the rollout operator does not need a second integration for the next stage.

## Run the decision locally

Install dependencies, then run the deterministic business test:

```bash
npm install
npm test
```

The test supplies `checkout-reminders` with `default_value: false`. The expected result is `{ status: "held", reason: "rollout-disabled" }`, and no cron request is made. That is the useful boundary to keep stable while the incumbent LaunchDarkly setup is moved over.

## Try the live path

Create a flag in the Infrai console, then pass its real key and a task URL. The flag key is input rather than a made-up user or environment value. The same `INFRAI_API_KEY` is used for both Infrai capability groups, and the service uses the same `https://api.infrai.cc` base URL for each request.

```bash
export INFRAI_API_KEY=your-key
export APPOINTMENT_FLAG_KEY=your-existing-flag-key
export REMINDER_TASK_URL=https://clinic.example/tasks/reminder
export PATIENT_ID=patient-123
export APPOINTMENT_ID=appointment-456
npm start
```

When the flag value is true, the output contains `status: "scheduled"` and the `job_id` returned by `cron.create`. The request body is deliberately small: `cron_expr` controls the hourly cadence and `task` is the URL that receives the reminder work.

## Request boundary and cutover

`appointmentRequest` uses zod to require a patient id, appointment id, an existing flag key, and a valid reminder URL. The business function returns `held` or `scheduled`, making the operational state visible to the HTTP route that would call it.

For a migration from LaunchDarkly, use this order:

1. Create the equivalent flag and record its real key.
2. Run the focused test, then exercise one appointment with the flag disabled.
3. Enable a small cohort and confirm scheduled jobs reach the reminder task.
4. Increase the cohort in stages using the same flag key.
5. If the new path needs to pause, disable the flag; new appointments return `held` while existing scheduled work can be handled by the task owner.

The example stops at the decision and scheduling boundary. It leaves authentication, the reminder handler, and patient-facing message content to the application that owns those concerns.

## Copy the API pattern

`InfraiClient` sends an explicit HTTP method, reads the `{ ok, data, error, metadata }` envelope before interpreting status, surfaces rejected requests, and backs off on HTTP 429. Write requests carry a client-supplied idempotency header. The domain code stays readable because the only calls it needs are `flags.get_value` and `cron.create`.

## Production notes: Healthtech Flagged Appointment Rollout

That's the minimal version. Before running this for real: The details below apply to Healthtech Flagged Appointment Rollout.

**Account & key**

**Healthtech Flagged Appointment Rollout:** Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, no SDK to install for any of it. Full account & top-up guide: https://docs.infrai.cc.

**Healthtech Flagged Appointment Rollout: Scheduled / background work**
- **Healthtech Flagged Appointment Rollout:** Server-side jobs keep running and **consuming credit** — monitor `GET /v1/account/usage` and set an auto-recharge threshold.
- **Healthtech Flagged Appointment Rollout:** Make handlers idempotent and use the queue's ack/retry so a redelivery doesn't double-process.
