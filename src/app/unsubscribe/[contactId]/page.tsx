"use client";

import { CheckCircle, Loader2, XCircle } from "lucide-react";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function UnsubscribePage() {
  const params = useParams();
  const contactId = params.contactId as string;
  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading",
  );

  useEffect(() => {
    if (!contactId) return;

    fetch(`/api/contacts/${contactId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ unsubscribed: true }),
    })
      .then((res) => {
        if (res.ok) setStatus("success");
        else setStatus("error");
      })
      .catch(() => setStatus("error"));
  }, [contactId]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] p-6">
      <div className="max-w-md w-full bg-[#1a1a1a] border border-white/[0.08] rounded-2xl p-8 text-center shadow-2xl">
        {status === "loading" && (
          <div className="space-y-4">
            <Loader2 className="w-12 h-12 text-emerald-500 animate-spin mx-auto" />
            <h1 className="text-xl font-semibold text-white">
              Processing request...
            </h1>
            <p className="text-zinc-400 text-sm">
              One moment while we update your preferences.
            </p>
          </div>
        )}

        {status === "success" && (
          <div className="space-y-4">
            <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto" />
            <h1 className="text-xl font-semibold text-white">
              Unsubscribed successfully
            </h1>
            <p className="text-zinc-400 text-sm">
              You have been removed from our mailing list. You will no longer
              receive marketing emails from this sender.
            </p>
          </div>
        )}

        {status === "error" && (
          <div className="space-y-4">
            <XCircle className="w-12 h-12 text-red-500 mx-auto" />
            <h1 className="text-xl font-semibold text-white">
              Something went wrong
            </h1>
            <p className="text-zinc-400 text-sm">
              We couldn't process your unsubscribe request. Please try again or
              contact support if the issue persists.
            </p>
          </div>
        )}

        <div className="mt-12 pt-6 border-t border-white/[0.04]">
          <p className="text-[10px] text-zinc-600 uppercase tracking-widest font-medium">
            Powered by OpenSend
          </p>
        </div>
      </div>
    </div>
  );
}
