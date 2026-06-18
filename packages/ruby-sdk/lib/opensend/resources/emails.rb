# frozen_string_literal: true

module OpenSend
  module Resources
    class Emails
      def initialize(http)
        @http = http
      end

      # POST /emails
      # Options hash may include idempotency_key: "..."
      def send(params, idempotency_key: nil)
        extra_headers = idempotency_key ? { "Idempotency-Key" => idempotency_key } : {}
        @http.post("/emails", normalize_keys(params), headers: extra_headers)
      end

      # POST /emails/batch
      def send_batch(payloads, idempotency_key: nil)
        extra_headers = idempotency_key ? { "Idempotency-Key" => idempotency_key } : {}
        @http.post("/emails/batch", payloads.map { |p| normalize_keys(p) }, headers: extra_headers)
      end

      # GET /api/emails
      def list(limit: nil, after: nil, before: nil, status: nil)
        params = {}
        params[:limit] = limit unless limit.nil?
        params[:after] = after if after
        params[:before] = before if before
        params[:status] = status if status
        @http.get("/api/emails", params)
      end

      # GET /api/emails/:id
      def get(id)
        @http.get("/api/emails/#{id}")
      end

      # POST /emails/:id/cancel
      def cancel(id)
        @http.post("/emails/#{id}/cancel")
      end

      private

      # Accept both snake_case and camelCase keys from callers; pass through as-is
      # (server handles normalization).
      def normalize_keys(params)
        return params unless params.is_a?(Hash)

        result = {}
        params.each do |k, v|
          result[k.to_s] = v
        end
        # camelCase alias: replyTo -> reply_to (server accepts both; keep user's intent)
        if result.key?("replyTo") && !result.key?("reply_to")
          result["reply_to"] = result.delete("replyTo")
        end
        result
      end
    end
  end
end
