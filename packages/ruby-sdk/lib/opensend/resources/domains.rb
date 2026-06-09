# frozen_string_literal: true

module OpenSend
  module Resources
    class Domains
      def initialize(http)
        @http = http
      end

      # POST /api/domains
      def create(params)
        @http.post("/api/domains", stringify(params))
      end

      # GET /api/domains
      def list
        @http.get("/api/domains")
      end

      # GET /api/domains/:id
      def get(id)
        @http.get("/api/domains/#{id}")
      end

      # PATCH /api/domains/:id
      def update(id, params)
        @http.patch("/api/domains/#{id}", stringify(params))
      end

      # POST /api/domains/:id/verify
      def verify(id)
        @http.post("/api/domains/#{id}/verify")
      end

      # DELETE /api/domains/:id
      def delete(id)
        @http.delete("/api/domains/#{id}")
      end

      private

      def stringify(params)
        return params unless params.is_a?(Hash)

        params.transform_keys(&:to_s)
      end
    end
  end
end
