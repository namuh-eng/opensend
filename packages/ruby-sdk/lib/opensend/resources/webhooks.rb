# frozen_string_literal: true

module OpenSend
  module Resources
    class Webhooks
      def initialize(http)
        @http = http
      end

      # POST /api/webhooks
      def create(params, idempotency_key: nil)
        extra_headers = idempotency_key ? { "Idempotency-Key" => idempotency_key } : {}
        @http.post("/api/webhooks", normalize(params), headers: extra_headers)
      end

      # GET /api/webhooks
      def list(limit: nil, after: nil)
        params = {}
        params[:limit] = limit unless limit.nil?
        params[:after] = after if after
        @http.get("/api/webhooks", params)
      end

      # GET /api/webhooks/:id
      def get(id)
        @http.get("/api/webhooks/#{id}")
      end

      # PATCH /api/webhooks/:id
      def update(id, params)
        @http.patch("/api/webhooks/#{id}", normalize(params))
      end

      # DELETE /api/webhooks/:id
      def delete(id)
        @http.delete("/api/webhooks/#{id}")
      end

      # GET /api/webhooks/:id/deliveries
      def list_deliveries(id, limit: nil, after: nil)
        params = {}
        params[:limit] = limit unless limit.nil?
        params[:after] = after if after
        @http.get("/api/webhooks/#{id}/deliveries", params)
      end

      # POST /api/webhooks/:id/deliveries/:delivery_id/replay
      def replay_delivery(id, delivery_id)
        @http.post("/api/webhooks/#{id}/deliveries/#{delivery_id}/replay")
      end

      private

      # The TS SDK accepts both "endpoint"/"url" and "events"/"event_types".
      # Pass through as-is; server handles aliases.
      def normalize(params)
        return {} if params.nil? || params.empty?

        params.transform_keys(&:to_s)
      end
    end
  end
end
