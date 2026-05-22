# frozen_string_literal: true

module OpenSend
  module Resources
    class Contacts
      def initialize(http)
        @http = http
      end

      # POST /contacts
      def create(params)
        @http.post("/contacts", stringify(params))
      end

      # GET /contacts  (with optional pagination)
      def list(limit: nil, after: nil)
        params = {}
        params[:limit] = limit unless limit.nil?
        params[:after] = after if after
        @http.get("/contacts", params)
      end

      # GET /contacts/:id
      def get(id)
        @http.get("/contacts/#{id}")
      end

      # PATCH /contacts/:id
      def update(id, params)
        @http.patch("/contacts/#{id}", stringify(params))
      end

      # DELETE /contacts/:id
      def delete(id)
        @http.delete("/contacts/#{id}")
      end

      private

      def stringify(params)
        return params unless params.is_a?(Hash)

        params.transform_keys(&:to_s)
      end
    end
  end
end
