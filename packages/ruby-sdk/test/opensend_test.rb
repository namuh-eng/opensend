# frozen_string_literal: true

require "json"
require "minitest/autorun"
require "webrick"

$LOAD_PATH.unshift(File.expand_path("../lib", __dir__))
require "opensend"

class OpenSendRubySdkTest < Minitest::Test
  RecordedRequest = Struct.new(:method, :path, :headers, :body, keyword_init: true)

  def setup
    @requests = []
    @response_status = 200
    @response_body = { "id" => "email_123" }
    @server = WEBrick::HTTPServer.new(
      BindAddress: "127.0.0.1",
      Port: 0,
      Logger: WEBrick::Log.new(File::NULL, WEBrick::Log::FATAL),
      AccessLog: []
    )
    @server.mount_proc("/") do |request, response|
      @requests << RecordedRequest.new(
        method: request.request_method,
        path: request.path,
        headers: request.header.transform_values(&:first),
        body: request.body.to_s.empty? ? nil : JSON.parse(request.body)
      )
      response.status = @response_status
      response["Content-Type"] = "application/json"
      response.body = JSON.generate(@response_body)
    end
    @thread = Thread.new { @server.start }
    @base_url = "http://127.0.0.1:#{@server.listeners.first.addr[1]}"
    OpenSend.api_key = nil
    OpenSend.base_url = OpenSend::DEFAULT_BASE_URL
  end

  def teardown
    @server.shutdown
    @thread.join(2)
    OpenSend.api_key = nil
    OpenSend.base_url = OpenSend::DEFAULT_BASE_URL
  end

  def test_module_level_send_serializes_payload_and_auth_header
    OpenSend.api_key "os_test"
    OpenSend.base_url @base_url

    response = OpenSend::Emails.send(
      from: "hello@example.com",
      to: "user@example.com",
      subject: "Hello",
      html: "<p>Hello</p>",
      tags: [{ name: "source", value: "ruby" }]
    )

    assert_equal({ "id" => "email_123" }, response)
    assert_equal(1, @requests.length)
    request = @requests.first
    assert_equal("POST", request.method)
    assert_equal("/emails", request.path)
    assert_equal("Bearer os_test", request.headers["authorization"])
    assert_equal("application/json", request.headers["content-type"])
    assert_equal("application/json", request.headers["accept"])
    assert_equal(OpenSend::USER_AGENT, request.headers["user-agent"])
    assert_equal(
      {
        "from" => "hello@example.com",
        "to" => "user@example.com",
        "subject" => "Hello",
        "html" => "<p>Hello</p>",
        "tags" => [{ "name" => "source", "value" => "ruby" }]
      },
      request.body
    )
  end

  def test_instance_client_uses_base_url_override
    client = OpenSend::Client.new(api_key: "os_instance", base_url: "#{@base_url}/api/")

    response = client.emails.send(
      from: "hello@example.com",
      to: ["user@example.com"],
      subject: "Hello",
      text: "Hello"
    )

    assert_equal("email_123", response.fetch("id"))
    request = @requests.first
    assert_equal("/api/emails", request.path)
    assert_equal("Bearer os_instance", request.headers["authorization"])
    assert_equal(
      {
        "from" => "hello@example.com",
        "to" => ["user@example.com"],
        "subject" => "Hello",
        "text" => "Hello"
      },
      request.body
    )
  end

  def test_resend_alias_targets_opensend_surface
    Resend.api_key "os_alias"
    Resend.base_url @base_url

    response = Resend::Emails.send(
      from: "hello@example.com",
      to: "user@example.com",
      subject: "Hello",
      html: "<p>Hello</p>"
    )

    assert_equal("email_123", response.fetch("id"))
    assert_equal("/emails", @requests.first.path)
    assert_equal("Bearer os_alias", @requests.first.headers["authorization"])
  end

  def test_api_error_exposes_public_error_envelope
    @response_status = 422
    @response_body = {
      "name" => "validation_error",
      "code" => "validation_error",
      "message" => "Validation failed.",
      "statusCode" => 422,
      "details" => { "fieldErrors" => { "to" => ["Required"] }, "formErrors" => [] }
    }
    client = OpenSend::Client.new(api_key: "os_error", base_url: @base_url)

    error = assert_raises(OpenSend::Error) do
      client.emails.send(
        from: "hello@example.com",
        to: "user@example.com",
        subject: "Hello",
        html: "<p>Hello</p>"
      )
    end

    assert_equal(422, error.status_code)
    assert_equal("validation_error", error.name)
    assert_equal("validation_error", error.code)
    assert_equal("Validation failed.", error.message)
    assert_equal({ "fieldErrors" => { "to" => ["Required"] }, "formErrors" => [] }, error.details)
    assert_includes(error.body, "validation_error")
  end

  def test_requires_api_key_and_valid_absolute_base_url
    assert_raises(ArgumentError) { OpenSend::Client.new(api_key: "", base_url: @base_url) }
    assert_raises(ArgumentError) { OpenSend::Client.new(api_key: "os_test", base_url: "ftp://example.com") }

    error = assert_raises(ArgumentError) do
      OpenSend::Emails.send(
        { from: "hello@example.com", to: "user@example.com", subject: "Hello", html: "<p>Hello</p>" },
        base_url: @base_url
      )
    end
    assert_match(/set OpenSend\.api_key/, error.message)
  end
end
