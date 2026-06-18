# frozen_string_literal: true

module OpenSend
  module Resources
    class Logs
      def initialize(http)
        @http = http
      end

      # GET /api/logs
      def list(limit: nil, after: nil, before: nil, status: nil, method: nil,
               api_key_id: nil, date_from: nil, date_to: nil, user_agent: nil, search: nil)
        params = {}
        params[:limit] = limit unless limit.nil?
        params[:after] = after if after
        params[:before] = before if before
        params[:status] = status if status
        params[:method] = method if method
        params[:api_key_id] = api_key_id if api_key_id
        params[:date_from] = date_from if date_from
        params[:date_to] = date_to if date_to
        params[:user_agent] = user_agent if user_agent
        params[:search] = search if search
        @http.get("/api/logs", params)
      end

      # GET /api/logs/:id
      def get(id)
        @http.get("/api/logs/#{id}")
      end
    end
  end
end
