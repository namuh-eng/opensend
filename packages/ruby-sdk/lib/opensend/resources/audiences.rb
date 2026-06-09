# frozen_string_literal: true

module OpenSend
  module Resources
    class Audiences
      def initialize(http)
        @http = http
      end

      # POST /audiences
      def create(params)
        @http.post("/audiences", stringify(params))
      end

      # GET /audiences
      def list(limit: nil, after: nil, search: nil)
        params = {}
        params[:limit] = limit unless limit.nil?
        params[:after] = after if after
        params[:search] = search if search
        @http.get("/audiences", params)
      end

      # GET /audiences/:id
      def get(id)
        @http.get("/audiences/#{id}")
      end

      # DELETE /audiences/:id
      def delete(id)
        @http.delete("/audiences/#{id}")
      end

      private

      def stringify(params)
        return params unless params.is_a?(Hash)

        params.transform_keys(&:to_s)
      end
    end
  end
end
