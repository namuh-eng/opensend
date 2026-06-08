import { handleSendCustomEventRequest } from "@/lib/api/events";

export async function POST(request: Request): Promise<Response> {
  return await handleSendCustomEventRequest(request);
}
