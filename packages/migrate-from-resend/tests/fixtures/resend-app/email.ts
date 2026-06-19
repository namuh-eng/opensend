import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

await resend.emails.send({
  from: "Acme <onboarding@resend.dev>",
  to: "user@example.com",
  subject: "Hello",
  html: "<p>Hello</p>",
});

await resend.emails.sendBatch([
  {
    from: "Acme <onboarding@resend.dev>",
    to: "user@example.com",
    subject: "Hello",
    html: "<p>Hello</p>",
  },
]);

await resend.contacts.create({ email: "user@example.com" });
await resend.broadcasts.create({ name: "Launch" });
await resend.emails.received.list();
await resend.someFutureResource.create({ enabled: true });
