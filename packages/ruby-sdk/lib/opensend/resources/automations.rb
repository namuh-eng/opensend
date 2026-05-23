# frozen_string_literal: true

module OpenSend
  module Resources
    class Automations
      def initialize(http)
        @http = http
      end

      # POST /api/automations
      def create(params)
        @http.post("/api/automations", normalize(params))
      end

      # GET /api/automations
      def list(limit: nil, after: nil, status: nil)
        params = {}
        params[:limit] = limit unless limit.nil?
        params[:after] = after if after
        params[:status] = status if status
        @http.get("/api/automations", params)
      end

      # GET /api/automations/:id
      def get(id)
        @http.get("/api/automations/#{id}")
      end

      # PATCH /api/automations/:id
      def update(id, params)
        @http.patch("/api/automations/#{id}", normalize(params))
      end

      # DELETE /api/automations/:id
      def delete(id)
        @http.delete("/api/automations/#{id}")
      end

      # GET /api/automations/:id/runs
      def list_runs(id, limit: nil, after: nil, status: nil)
        params = {}
        params[:limit] = limit unless limit.nil?
        params[:after] = after if after
        params[:status] = status if status
        @http.get("/api/automations/#{id}/runs", params)
      end

      # GET /api/automations/:id/runs/:run_id
      def get_run(id, run_id)
        @http.get("/api/automations/#{id}/runs/#{run_id}")
      end

      # POST /api/automations/:id/runs/:run_id/cancel
      def cancel_run(id, run_id, reason: nil)
        payload = reason ? { "reason" => reason } : {}
        @http.post("/api/automations/#{id}/runs/#{run_id}/cancel", payload)
      end

      # GET /api/automations/:id/runs/metrics
      def get_run_metrics(id, from: nil, to: nil)
        params = {}
        params[:from] = from if from
        params[:to] = to if to
        @http.get("/api/automations/#{id}/runs/metrics", params)
      end

      private

      ALIASES = {
        "triggerEventName" => "trigger_event_name"
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
