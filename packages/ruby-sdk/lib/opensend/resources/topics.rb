# frozen_string_literal: true

module OpenSend
  module Resources
    class Topics
      def initialize(http)
        @http = http
      end

      # POST /api/topics
      def create(params)
        @http.post("/api/topics", normalize(params))
      end

      # GET /api/topics
      def list(limit: nil, after: nil, search: nil)
        params = {}
        params[:limit] = limit unless limit.nil?
        params[:after] = after if after
        params[:search] = search if search
        @http.get("/api/topics", params)
      end

      # GET /api/topics/:id
      def get(id)
        @http.get("/api/topics/#{id}")
      end

      # PATCH /api/topics/:id
      def update(id, params)
        @http.patch("/api/topics/#{id}", normalize(params))
      end

      # DELETE /api/topics/:id
      def delete(id)
        @http.delete("/api/topics/#{id}")
      end

      private

      ALIASES = {
        "defaultSubscription" => "default_subscription"
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
