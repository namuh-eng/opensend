# frozen_string_literal: true

module OpenSend
  module Resources
    class Templates
      def initialize(http)
        @http = http
      end

      # POST /templates
      def create(params)
        @http.post("/templates", normalize(params))
      end

      # GET /templates
      def list(limit: nil, after: nil, search: nil, status: nil)
        params = {}
        params[:limit] = limit unless limit.nil?
        params[:after] = after if after
        params[:search] = search if search
        params[:status] = status if status
        @http.get("/templates", params)
      end

      # GET /templates/:id_or_alias
      def get(id_or_alias)
        @http.get("/templates/#{id_or_alias}")
      end

      # PATCH /templates/:id_or_alias
      def update(id_or_alias, params)
        @http.patch("/templates/#{id_or_alias}", normalize(params))
      end

      # DELETE /templates/:id_or_alias
      def delete(id_or_alias)
        @http.delete("/templates/#{id_or_alias}")
      end

      # POST /templates/:id_or_alias/publish
      def publish(id_or_alias)
        @http.post("/templates/#{id_or_alias}/publish")
      end

      # POST /templates/:id_or_alias/duplicate
      def duplicate(id_or_alias)
        @http.post("/templates/#{id_or_alias}/duplicate")
      end

      private

      ALIASES = {
        "replyTo" => "reply_to",
        "previewText" => "preview_text",
        "fallbackValue" => "fallback_value"
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
