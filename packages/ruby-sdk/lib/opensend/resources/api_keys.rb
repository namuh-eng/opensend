# frozen_string_literal: true

module OpenSend
  module Resources
    class ApiKeys
      def initialize(http)
        @http = http
      end

      # POST /api-keys
      def create(params)
        @http.post("/api-keys", stringify(params))
      end

      # GET /api-keys
      def list
        @http.get("/api-keys")
      end

      # DELETE /api-keys/:id
      def delete(id)
        @http.delete("/api-keys/#{id}")
      end

      private

      def stringify(params)
        return params unless params.is_a?(Hash)

        params.transform_keys(&:to_s)
      end
    end
  end
end
