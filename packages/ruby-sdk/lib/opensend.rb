# frozen_string_literal: true

require "json"
require "net/http"
require "uri"

require_relative "opensend/version"

module OpenSend
  DEFAULT_BASE_URL = "https://opensend.namuh.co"
  USER_AGENT = "opensend-ruby/#{VERSION}"

  class << self
    attr_writer :api_key, :base_url

    def api_key(value = nil)
      @api_key = value unless value.nil?
      @api_key
    end

    def base_url(value = nil)
      @base_url = value unless value.nil?
      @base_url || DEFAULT_BASE_URL
    end

    def emails
      EmailsResource.new(Client.new(api_key: configured_api_key, base_url: base_url))
    end

    private

    def configured_api_key
      key = api_key
      raise ArgumentError, "set OpenSend.api_key before making API requests" if key.nil? || key.to_s.strip.empty?

      key
    end
  end

  class Error < StandardError
    attr_reader :status_code, :name, :code, :details, :body

    def initialize(message, status_code:, name: nil, code: nil, details: nil, body: nil)
      super(message)
      @status_code = status_code
      @name = name
      @code = code
      @details = details
      @body = body
    end
  end

  APIError = Error

  class Client
    attr_reader :api_key, :base_url

    def initialize(api_key:, base_url: DEFAULT_BASE_URL)
      @api_key = normalize_api_key(api_key)
      @base_uri = normalize_base_url(base_url)
      @base_url = @base_uri.to_s
    end

    def emails
      EmailsResource.new(self)
    end

    def post(path, payload)
      uri = endpoint(path)
      request = Net::HTTP::Post.new(uri)
      request["Authorization"] = "Bearer #{api_key}"
      request["Content-Type"] = "application/json"
      request["Accept"] = "application/json"
      request["User-Agent"] = USER_AGENT
      request.body = JSON.generate(payload)

      response = perform_request(uri, request)
      body = response.body.to_s

      unless response.is_a?(Net::HTTPSuccess)
        raise api_error(response, body)
      end

      body.empty? ? {} : JSON.parse(body)
    rescue JSON::ParserError => error
      raise Error.new(
        "Invalid JSON response from OpenSend",
        status_code: 0,
        name: "parse_error",
        code: "parse_error",
        body: error.message
      )
    rescue IOError, SystemCallError, Timeout::Error, SocketError => error
      raise Error.new(
        error.message,
        status_code: 0,
        name: "request_error",
        code: "request_error"
      )
    end

    private

    def normalize_api_key(value)
      key = value.to_s.strip
      raise ArgumentError, "API key is required" if key.empty?

      key
    end

    def normalize_base_url(value)
      raw = value.to_s.strip
      raise ArgumentError, "base URL must be a non-empty string" if raw.empty?

      uri = URI.parse(raw)
      unless uri.is_a?(URI::HTTP) && uri.host
        raise ArgumentError, "base URL must be a valid absolute http or https URL"
      end

      uri.path = uri.path.to_s.sub(%r{/+\z}, "")
      uri.query = nil
      uri.fragment = nil
      uri
    rescue URI::InvalidURIError
      raise ArgumentError, "base URL must be a valid absolute http or https URL"
    end

    def endpoint(path)
      uri = @base_uri.dup
      base_path = uri.path.to_s.sub(%r{/+\z}, "")
      request_path = "/#{path.to_s.sub(%r{\A/+}, "")}"
      uri.path = base_path.empty? ? request_path : "#{base_path}#{request_path}"
      uri.query = nil
      uri.fragment = nil
      uri
    end

    def perform_request(uri, request)
      Net::HTTP.start(uri.host, uri.port, use_ssl: uri.scheme == "https") do |http|
        http.request(request)
      end
    end

    def api_error(response, body)
      envelope = parse_json_object(body)
      message = envelope["message"] || response.message || "OpenSend API request failed"

      Error.new(
        message,
        status_code: response.code.to_i,
        name: envelope["name"],
        code: envelope["code"],
        details: envelope["details"],
        body: body
      )
    end

    def parse_json_object(body)
      parsed = body.empty? ? {} : JSON.parse(body)
      parsed.is_a?(Hash) ? parsed : {}
    rescue JSON::ParserError
      {}
    end
  end

  class EmailsResource
    def initialize(client)
      @client = client
    end

    def send(params)
      @client.post("/emails", params)
    end
  end

  module Emails
    def self.send(params, api_key: nil, base_url: nil)
      key = api_key || OpenSend.api_key
      raise ArgumentError, "set OpenSend.api_key before making API requests" if key.nil? || key.to_s.strip.empty?

      Client.new(api_key: key, base_url: base_url || OpenSend.base_url).emails.send(params)
    end
  end
end

Resend = OpenSend unless defined?(Resend)
