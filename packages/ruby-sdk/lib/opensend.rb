# frozen_string_literal: true

require "json"
require "net/http"
require "uri"

require_relative "opensend/version"
require_relative "opensend/http_client"
require_relative "opensend/resources/emails"
require_relative "opensend/resources/domains"
require_relative "opensend/resources/api_keys"
require_relative "opensend/resources/contacts"
require_relative "opensend/resources/segments"
require_relative "opensend/resources/audiences"
require_relative "opensend/resources/broadcasts"
require_relative "opensend/resources/templates"
require_relative "opensend/resources/automations"
require_relative "opensend/resources/events"
require_relative "opensend/resources/webhooks"
require_relative "opensend/resources/topics"
require_relative "opensend/resources/suppressions"
require_relative "opensend/resources/logs"

module OpenSend
  DEFAULT_BASE_URL = "https://opensend.namuh.co"
  USER_AGENT = "opensend-ruby/#{VERSION}"

  # ---------------------------------------------------------------------------
  # Module-level convenience API
  # ---------------------------------------------------------------------------
  # Configure once at startup, then call resources directly:
  #
  #   OpenSend.api_key ENV["OPENSEND_API_KEY"]
  #   OpenSend.emails.send(from: ..., to: ..., subject: ..., html: ...)
  #   OpenSend.domains.list
  # ---------------------------------------------------------------------------

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

    # Each resource method builds a fresh client so the caller's api_key/base_url
    # configuration is always read at call-time, not at load-time.
    def emails
      Resources::Emails.new(module_http_client)
    end

    def domains
      Resources::Domains.new(module_http_client)
    end

    def api_keys
      Resources::ApiKeys.new(module_http_client)
    end

    def contacts
      Resources::Contacts.new(module_http_client)
    end

    def segments
      Resources::Segments.new(module_http_client)
    end

    def audiences
      Resources::Audiences.new(module_http_client)
    end

    def broadcasts
      Resources::Broadcasts.new(module_http_client)
    end

    def templates
      Resources::Templates.new(module_http_client)
    end

    def automations
      Resources::Automations.new(module_http_client)
    end

    def events
      Resources::Events.new(module_http_client)
    end

    def webhooks
      Resources::Webhooks.new(module_http_client)
    end

    def topics
      Resources::Topics.new(module_http_client)
    end

    def suppressions
      Resources::Suppressions.new(module_http_client)
    end

    def logs
      Resources::Logs.new(module_http_client)
    end

    private

    def module_http_client
      key = api_key
      raise ArgumentError, "set OpenSend.api_key before making API requests" if key.nil? || key.to_s.strip.empty?

      Client.new(api_key: key, base_url: base_url).http_client
    end
  end

  # ---------------------------------------------------------------------------
  # Error
  # ---------------------------------------------------------------------------

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

  # ---------------------------------------------------------------------------
  # Client  (instance API)
  # ---------------------------------------------------------------------------
  # client = OpenSend::Client.new(api_key: "os_...", base_url: "https://...")
  # client.emails.send(...)
  # client.domains.list
  # ---------------------------------------------------------------------------

  class Client
    attr_reader :api_key, :base_url

    def initialize(api_key:, base_url: DEFAULT_BASE_URL)
      @api_key  = normalize_api_key(api_key)
      @base_uri = normalize_base_url(base_url)
      @base_url = @base_uri.to_s.sub(%r{/+\z}, "")
      @http     = HttpClient.new(api_key: @api_key, base_uri: @base_uri)
    end

    # Expose the inner HttpClient so the module-level helpers can reuse it.
    def http_client
      @http
    end

    def emails
      Resources::Emails.new(@http)
    end

    def domains
      Resources::Domains.new(@http)
    end

    def api_keys
      Resources::ApiKeys.new(@http)
    end

    def contacts
      Resources::Contacts.new(@http)
    end

    def segments
      Resources::Segments.new(@http)
    end

    def audiences
      Resources::Audiences.new(@http)
    end

    def broadcasts
      Resources::Broadcasts.new(@http)
    end

    def templates
      Resources::Templates.new(@http)
    end

    def automations
      Resources::Automations.new(@http)
    end

    def events
      Resources::Events.new(@http)
    end

    def webhooks
      Resources::Webhooks.new(@http)
    end

    def topics
      Resources::Topics.new(@http)
    end

    def suppressions
      Resources::Suppressions.new(@http)
    end

    def logs
      Resources::Logs.new(@http)
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
  end

  # ---------------------------------------------------------------------------
  # Legacy namespace-style convenience modules (e.g. OpenSend::Emails.send)
  # These delegate to the module-level configured client.
  # ---------------------------------------------------------------------------

  module Emails
    def self.send(params, api_key: nil, base_url: nil, idempotency_key: nil)
      key = api_key || OpenSend.api_key
      raise ArgumentError, "set OpenSend.api_key before making API requests" if key.nil? || key.to_s.strip.empty?

      client = Client.new(api_key: key, base_url: base_url || OpenSend.base_url)
      client.emails.send(params, idempotency_key: idempotency_key)
    end
  end

  # EmailsResource is kept as a backwards-compatible alias used by legacy callers
  # who hold a raw client handle (e.g. client.emails → EmailsResource instance).
  EmailsResource = Resources::Emails
end

# Resend is exported as a drop-in alias for code migrating to OpenSend.
Resend = OpenSend unless defined?(Resend)
