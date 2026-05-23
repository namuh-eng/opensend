# frozen_string_literal: true

require "uri"

module OpenSend
  module Resources
    class Suppressions
      def initialize(http)
        @http = http
      end

      # GET /api/suppressions
      def list(limit: nil, after: nil)
        params = {}
        params[:limit] = limit unless limit.nil?
        params[:after] = after if after
        @http.get("/api/suppressions", params)
      end

      # GET /api/suppressions/:email  (URL-encoded)
      def get(email)
        @http.get("/api/suppressions/#{URI.encode_www_form_component(email)}")
      end

      # POST /api/suppressions
      def create(params, idempotency_key: nil)
        extra_headers = idempotency_key ? { "Idempotency-Key" => idempotency_key } : {}
        @http.post("/api/suppressions", stringify(params), headers: extra_headers)
      end

      # DELETE /api/suppressions/:email  (URL-encoded)
      def delete(email)
        @http.delete("/api/suppressions/#{URI.encode_www_form_component(email)}")
      end

      private

      def stringify(params)
        return params unless params.is_a?(Hash)

        params.transform_keys(&:to_s)
      end
    end
  end
end
