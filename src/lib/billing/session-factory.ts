import { planRepo, stripeCustomerRepo } from "@opensend/core";
import { createBillingSessionService } from "./sessions";
import { getStripe } from "./stripe";

export function createDefaultBillingSessionService() {
  return createBillingSessionService({
    plans: planRepo,
    stripeCustomers: stripeCustomerRepo,
    stripe: getStripe,
  });
}
