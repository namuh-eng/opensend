# Suppression list scope

OpenSend suppresses recipient addresses after SES reports a hard bounce or a complaint. For this first parity slice, suppression records are scoped to the OpenSend account/user that sent the original email. Future sends for that same user skip or reject suppressed `to` recipients before queueing delivery.

Operators can remove a recipient from the suppression list with `DELETE /api/suppressions/{email}`. Removal is not permanent: if SES reports another hard bounce or complaint for the same user and recipient, OpenSend creates or refreshes the suppression again.

Region-wide, provider-wide, and automatic time-based unsuppression policies are intentionally deferred.
