# frozen_string_literal: true

require "json"
require "net/http"
require "uri"

module OpenSend
  # Low-level HTTP client shared by every resource. Supports GET, POST, PATCH,
  # and DELETE. Raises OpenSend::Error on non-2xx responses.
  class HttpClient
    def initialize(api_key:, base_uri:)
      @api_key = api_key
      @base_uri = base_uri
    end

    # GET with optional Hash of query params.
    def get(path, params = {})
      uri = endpoint(path, params)
      request = build_request(Net::HTTP::Get, uri)
      perform(uri, request)
    end

    # POST with a body Hash (serialised to JSON).
    def post(path, payload = nil, headers: {})
      uri = endpoint(path)
      request = build_request(Net::HTTP::Post, uri, headers: headers)
      request.body = payload.nil? ? "" : JSON.generate(payload)
      perform(uri, request)
    end

    # PATCH with a body Hash.
    def patch(path, payload = nil)
      uri = endpoint(path)
      request = build_request(Net::HTTP::Patch, uri)
      request.body = payload.nil? ? "" : JSON.generate(payload)
      perform(uri, request)
    end

    # DELETE (no body).
    def delete(path)
      uri = endpoint(path)
      request = build_request(Net::HTTP::Delete, uri)
      perform(uri, request)
    end

    private

    def endpoint(path, params = {})
      uri = @base_uri.dup
      base_path = uri.path.to_s.sub(%r{/+\z}, "")
      request_path = "/#{path.to_s.sub(%r{\A/+}, "")}"
      uri.path = base_path.empty? ? request_path : "#{base_path}#{request_path}"
      uri.fragment = nil
      if params && !params.empty?
        uri.query = URI.encode_www_form(params.reject { |_, v| v.nil? })
      else
        uri.query = nil
      end
      uri
    end

    def build_request(klass, uri, headers: {})
      request = klass.new(uri)
      request["Authorization"] = "Bearer #{@api_key}"
      request["Content-Type"] = "application/json"
      request["Accept"] = "application/json"
      request["User-Agent"] = USER_AGENT
      headers.each { |k, v| request[k] = v }
      request
    end

    def perform(uri, request)
      response = Net::HTTP.start(uri.host, uri.port, use_ssl: uri.scheme == "https") do |http|
        http.request(request)
      end

      body = response.body.to_s

      unless response.is_a?(Net::HTTPSuccess)
        raise parse_error(response, body)
      end

      body.empty? ? {} : JSON.parse(body)
    rescue JSON::ParserError => e
      raise Error.new(
        "Invalid JSON response from OpenSend",
        status_code: 0,
        name: "parse_error",
        code: "parse_error",
        body: e.message
      )
    rescue IOError, SystemCallError, Timeout::Error, SocketError => e
      raise Error.new(
        e.message,
        status_code: 0,
        name: "request_error",
        code: "request_error"
      )
    end

    def parse_error(response, body)
      envelope = begin
        parsed = body.empty? ? {} : JSON.parse(body)
        parsed.is_a?(Hash) ? parsed : {}
      rescue JSON::ParserError
        {}
      end

      message = envelope["message"] || envelope["error"] || response.message || "OpenSend API request failed"

      Error.new(
        message,
        status_code: response.code.to_i,
        name: envelope["name"],
        code: envelope["code"],
        details: envelope["details"],
        body: body
      )
    end
  end
end
