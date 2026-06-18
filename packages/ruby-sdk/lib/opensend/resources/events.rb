# frozen_string_literal: true

module OpenSend
  module Resources
    class Events
      def initialize(http)
        @http = http
      end

      # POST /api/events  — define a custom event schema
      def create(params)
        @http.post("/api/events", stringify(params))
      end

      # GET /api/events
      def list(limit: nil, after: nil)
        params = {}
        params[:limit] = limit unless limit.nil?
        params[:after] = after if after
        @http.get("/api/events", params)
      end

      # POST /api/events/send  — fire a custom event to trigger automations
      def send(params)
        @http.post("/api/events/send", normalize(params))
      end

      private

      def stringify(params)
        return params unless params.is_a?(Hash)

        params.transform_keys(&:to_s)
      end

      ALIASES = {
        "contactId" => "contact_id"
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
