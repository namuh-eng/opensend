# frozen_string_literal: true

module OpenSend
  module Resources
    class Segments
      def initialize(http)
        @http = http
      end

      # POST /segments
      def create(params)
        @http.post("/segments", stringify(params))
      end

      # GET /segments
      def list(limit: nil, after: nil, search: nil)
        params = {}
        params[:limit] = limit unless limit.nil?
        params[:after] = after if after
        params[:search] = search if search
        @http.get("/segments", params)
      end

      # GET /segments/:id
      def get(id)
        @http.get("/segments/#{id}")
      end

      # DELETE /segments/:id
      def delete(id)
        @http.delete("/segments/#{id}")
      end

      # GET /segments/:id/contacts
      def list_contacts(id, limit: nil, after: nil)
        params = {}
        params[:limit] = limit unless limit.nil?
        params[:after] = after if after
        @http.get("/segments/#{id}/contacts", params)
      end

      private

      def stringify(params)
        return params unless params.is_a?(Hash)

        params.transform_keys(&:to_s)
      end
    end
  end
end
