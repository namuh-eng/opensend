# frozen_string_literal: true

module OpenSend
  module Resources
    class Broadcasts
      def initialize(http)
        @http = http
      end

      # POST /broadcasts
      # Options hash may include idempotency_key: "..."
      def create(params, idempotency_key: nil)
        extra_headers = idempotency_key ? { "Idempotency-Key" => idempotency_key } : {}
        @http.post("/broadcasts", normalize(params), headers: extra_headers)
      end

      # GET /broadcasts
      def list(limit: nil, after: nil, search: nil, status: nil, segment_id: nil)
        params = {}
        params[:limit] = limit unless limit.nil?
        params[:after] = after if after
        params[:search] = search if search
        params[:status] = status if status
        params[:segmentId] = segment_id if segment_id
        @http.get("/broadcasts", params)
      end

      # GET /broadcasts/:id
      def get(id)
        @http.get("/broadcasts/#{id}")
      end

      # PATCH /broadcasts/:id
      def update(id, params)
        @http.patch("/broadcasts/#{id}", normalize(params))
      end

      # DELETE /broadcasts/:id
      def delete(id)
        @http.delete("/broadcasts/#{id}")
      end

      # POST /broadcasts/:id/send
      # Options hash may include idempotency_key: "..."
      def send(id, params = {}, idempotency_key: nil)
        extra_headers = idempotency_key ? { "Idempotency-Key" => idempotency_key } : {}
        @http.post("/broadcasts/#{id}/send", normalize(params), headers: extra_headers)
      end

      private

      # Normalise camelCase aliases to snake_case to match what the server expects.
      ALIASES = {
        "segmentId" => "segment_id",
        "topicId" => "topic_id",
        "replyTo" => "reply_to",
        "previewText" => "preview_text",
        "scheduledAt" => "scheduled_at"
      }.freeze

      def normalize(params)
        return {} if params.nil? || params.empty?

        result = {}
        params.each do |k, v|
          key = k.to_s
          result[ALIASES.fetch(key, key)] = v
        end
        result
      end
    end
  end
end
