# frozen_string_literal: true

require "json"
require "minitest/autorun"
require "webrick"

$LOAD_PATH.unshift(File.expand_path("../lib", __dir__))
require "opensend"

# ---------------------------------------------------------------------------
# Shared test server harness
#
# Uses a WEBrick AbstractServlet so that PATCH and DELETE are accepted.
# Paths are taken from `unparsed_uri` so percent-encoded segments (e.g. %40
# in email addresses) remain intact for assertions.
# ---------------------------------------------------------------------------
module TestServer
  RecordedRequest = Struct.new(:method, :path, :query, :headers, :body, keyword_init: true)

  class CatchAllServlet < WEBrick::HTTPServlet::AbstractServlet
    def initialize(server, requests, response_holder)
      super(server)
      @requests = requests
      @response_holder = response_holder
    end

    %w[GET POST PATCH DELETE PUT].each do |verb|
      define_method(:"do_#{verb}") { |req, res| handle(req, res) }
    end

    private

    def handle(req, res)
      raw = req.unparsed_uri || req.path
      path_part, query_string = raw.split("?", 2)
      query = query_string ? URI.decode_www_form(query_string).to_h : {}

      body_val = if req.body.to_s.empty?
        nil
      else
        begin; JSON.parse(req.body); rescue JSON::ParserError; req.body; end
      end

      @requests << RecordedRequest.new(
        method: req.request_method,
        path: path_part,
        query: query,
        headers: req.header.transform_values(&:first),
        body: body_val
      )

      res.status = @response_holder[:status]
      res["Content-Type"] = "application/json"
      res.body = JSON.generate(@response_holder[:body])
    end
  end

  def setup
    @requests = []
    @response_holder = { status: 200, body: {} }
    @server = WEBrick::HTTPServer.new(
      BindAddress: "127.0.0.1",
      Port: 0,
      Logger: WEBrick::Log.new(File::NULL, WEBrick::Log::FATAL),
      AccessLog: []
    )
    @server.mount("/", CatchAllServlet, @requests, @response_holder)
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

  def set_response(status: 200, body: {})
    @response_holder[:status] = status
    @response_holder[:body] = body
  end

  def client
    @client ||= OpenSend::Client.new(api_key: "os_test", base_url: @base_url)
  end

  def last_request
    @requests.last
  end
end

# ===========================================================================
# Emails
# ===========================================================================
class EmailsTest < Minitest::Test
  include TestServer

  def test_send_posts_to_emails
    set_response(body: { "id" => "email_123" })
    result = client.emails.send(from: "a@b.com", to: "c@d.com", subject: "Hi", html: "<p>Hi</p>")

    assert_equal "email_123", result["id"]
    assert_equal "POST", last_request.method
    assert_equal "/emails", last_request.path
    assert_equal "Bearer os_test", last_request.headers["authorization"]
    assert_equal "application/json", last_request.headers["content-type"]
  end

  def test_send_accepts_idempotency_key
    set_response(body: { "id" => "email_idem" })
    client.emails.send({ from: "a@b.com", to: "c@d.com", subject: "Hi" }, idempotency_key: "key-abc")

    assert_equal "key-abc", last_request.headers["idempotency-key"]
  end

  def test_send_batch_posts_to_emails_batch
    set_response(body: { "object" => "list", "data" => [] })
    payloads = [
      { from: "a@b.com", to: "c@d.com", subject: "A" },
      { from: "a@b.com", to: "e@f.com", subject: "B" }
    ]
    client.emails.send_batch(payloads)

    assert_equal "POST", last_request.method
    assert_equal "/emails/batch", last_request.path
    assert_kind_of Array, last_request.body
    assert_equal 2, last_request.body.length
  end

  def test_send_batch_accepts_idempotency_key
    set_response(body: { "data" => [] })
    client.emails.send_batch([{ from: "a@b.com", to: "c@d.com", subject: "A" }], idempotency_key: "batch-key")

    assert_equal "batch-key", last_request.headers["idempotency-key"]
  end

  def test_list_gets_api_emails
    set_response(body: { "object" => "list", "data" => [], "has_more" => false })
    client.emails.list(limit: 10, status: "sent")

    assert_equal "GET", last_request.method
    assert_equal "/api/emails", last_request.path
    assert_equal "10", last_request.query["limit"]
    assert_equal "sent", last_request.query["status"]
  end

  def test_get_fetches_single_email
    set_response(body: { "id" => "email_abc" })
    client.emails.get("email_abc")

    assert_equal "GET", last_request.method
    assert_equal "/api/emails/email_abc", last_request.path
  end

  def test_cancel_posts_to_cancel_path
    set_response(body: { "object" => "email", "id" => "email_abc" })
    client.emails.cancel("email_abc")

    assert_equal "POST", last_request.method
    assert_equal "/emails/email_abc/cancel", last_request.path
  end

  def test_reply_to_camel_case_normalised
    set_response(body: { "id" => "email_rt" })
    client.emails.send(from: "a@b.com", to: "c@d.com", subject: "Hi", replyTo: "x@y.com")

    body = last_request.body
    assert_equal "x@y.com", body["reply_to"]
    refute body.key?("replyTo")
  end
end

# ===========================================================================
# Domains
# ===========================================================================
class DomainsTest < Minitest::Test
  include TestServer

  def test_create_posts_to_api_domains
    set_response(body: { "id" => "dom_1", "object" => "domain" })
    result = client.domains.create(name: "example.com")

    assert_equal "POST", last_request.method
    assert_equal "/api/domains", last_request.path
    assert_equal "example.com", last_request.body["name"]
  end

  def test_list_gets_api_domains
    set_response(body: { "object" => "list", "data" => [] })
    client.domains.list

    assert_equal "GET", last_request.method
    assert_equal "/api/domains", last_request.path
  end

  def test_get_fetches_single_domain
    set_response(body: { "id" => "dom_1" })
    client.domains.get("dom_1")

    assert_equal "GET", last_request.method
    assert_equal "/api/domains/dom_1", last_request.path
  end

  def test_update_patches_domain
    set_response(body: { "object" => "domain", "id" => "dom_1" })
    client.domains.update("dom_1", open_tracking: true)

    assert_equal "PATCH", last_request.method
    assert_equal "/api/domains/dom_1", last_request.path
  end

  def test_verify_posts_to_verify_path
    set_response(body: { "object" => "domain", "id" => "dom_1" })
    client.domains.verify("dom_1")

    assert_equal "POST", last_request.method
    assert_equal "/api/domains/dom_1/verify", last_request.path
  end

  def test_delete_deletes_domain
    set_response(body: { "object" => "domain", "id" => "dom_1", "deleted" => true })
    client.domains.delete("dom_1")

    assert_equal "DELETE", last_request.method
    assert_equal "/api/domains/dom_1", last_request.path
  end
end

# ===========================================================================
# API Keys
# ===========================================================================
class ApiKeysTest < Minitest::Test
  include TestServer

  def test_create_posts_to_api_keys
    set_response(body: { "id" => "key_1", "token" => "os_live_abc" })
    client.api_keys.create(name: "My Key")

    assert_equal "POST", last_request.method
    assert_equal "/api-keys", last_request.path
    assert_equal "My Key", last_request.body["name"]
  end

  def test_list_gets_api_keys
    set_response(body: { "object" => "list", "data" => [] })
    client.api_keys.list

    assert_equal "GET", last_request.method
    assert_equal "/api-keys", last_request.path
  end

  def test_delete_deletes_api_key
    set_response(body: {})
    client.api_keys.delete("key_1")

    assert_equal "DELETE", last_request.method
    assert_equal "/api-keys/key_1", last_request.path
  end
end

# ===========================================================================
# Contacts
# ===========================================================================
class ContactsTest < Minitest::Test
  include TestServer

  def test_create_posts_to_contacts
    set_response(body: { "id" => "contact_1" })
    client.contacts.create(email: "user@example.com")

    assert_equal "POST", last_request.method
    assert_equal "/contacts", last_request.path
    assert_equal "user@example.com", last_request.body["email"]
  end

  def test_list_gets_contacts_with_pagination
    set_response(body: { "object" => "list", "data" => [], "has_more" => false })
    client.contacts.list(limit: 5, after: "cursor_abc")

    assert_equal "GET", last_request.method
    assert_equal "/contacts", last_request.path
    assert_equal "5", last_request.query["limit"]
    assert_equal "cursor_abc", last_request.query["after"]
  end

  def test_get_fetches_single_contact
    set_response(body: { "id" => "contact_1" })
    client.contacts.get("contact_1")

    assert_equal "GET", last_request.method
    assert_equal "/contacts/contact_1", last_request.path
  end

  def test_update_patches_contact
    set_response(body: { "id" => "contact_1" })
    client.contacts.update("contact_1", first_name: "Alice")

    assert_equal "PATCH", last_request.method
    assert_equal "/contacts/contact_1", last_request.path
  end

  def test_delete_deletes_contact
    set_response(body: { "deleted" => true })
    client.contacts.delete("contact_1")

    assert_equal "DELETE", last_request.method
    assert_equal "/contacts/contact_1", last_request.path
  end
end

# ===========================================================================
# Segments
# ===========================================================================
class SegmentsTest < Minitest::Test
  include TestServer

  def test_create_posts_to_segments
    set_response(body: { "id" => "seg_1" })
    client.segments.create(name: "VIP")

    assert_equal "POST", last_request.method
    assert_equal "/segments", last_request.path
  end

  def test_list_with_search
    set_response(body: { "object" => "list", "data" => [] })
    client.segments.list(search: "vip")

    assert_equal "GET", last_request.method
    assert_equal "/segments", last_request.path
    assert_equal "vip", last_request.query["search"]
  end

  def test_get_fetches_segment
    set_response(body: { "id" => "seg_1" })
    client.segments.get("seg_1")

    assert_equal "/segments/seg_1", last_request.path
  end

  def test_delete_deletes_segment
    set_response(body: { "deleted" => true })
    client.segments.delete("seg_1")

    assert_equal "DELETE", last_request.method
    assert_equal "/segments/seg_1", last_request.path
  end

  def test_list_contacts_gets_segment_contacts
    set_response(body: { "object" => "list", "data" => [] })
    client.segments.list_contacts("seg_1", limit: 20)

    assert_equal "GET", last_request.method
    assert_equal "/segments/seg_1/contacts", last_request.path
    assert_equal "20", last_request.query["limit"]
  end
end

# ===========================================================================
# Audiences
# ===========================================================================
class AudiencesTest < Minitest::Test
  include TestServer

  def test_create_posts_to_audiences
    set_response(body: { "id" => "aud_1" })
    client.audiences.create(name: "Newsletter")

    assert_equal "POST", last_request.method
    assert_equal "/audiences", last_request.path
  end

  def test_list_audiences
    set_response(body: { "object" => "list", "data" => [] })
    client.audiences.list(limit: 3)

    assert_equal "GET", last_request.method
    assert_equal "/audiences", last_request.path
    assert_equal "3", last_request.query["limit"]
  end

  def test_get_fetches_audience
    set_response(body: { "id" => "aud_1" })
    client.audiences.get("aud_1")

    assert_equal "/audiences/aud_1", last_request.path
  end

  def test_delete_deletes_audience
    set_response(body: { "deleted" => true })
    client.audiences.delete("aud_1")

    assert_equal "DELETE", last_request.method
    assert_equal "/audiences/aud_1", last_request.path
  end
end

# ===========================================================================
# Broadcasts
# ===========================================================================
class BroadcastsTest < Minitest::Test
  include TestServer

  def test_create_posts_to_broadcasts
    set_response(body: { "id" => "bc_1", "object" => "broadcast", "name" => "May sale", "status" => "draft" })
    client.broadcasts.create(from: "news@example.com", subject: "May sale", name: "May sale")

    assert_equal "POST", last_request.method
    assert_equal "/broadcasts", last_request.path
    assert_equal "news@example.com", last_request.body["from"]
  end

  def test_create_normalises_camel_aliases
    set_response(body: { "id" => "bc_2" })
    client.broadcasts.create(
      from: "news@example.com",
      subject: "Hi",
      replyTo: "help@example.com",
      scheduledAt: "2026-06-01T10:00:00Z"
    )

    body = last_request.body
    assert_equal "help@example.com", body["reply_to"]
    assert_equal "2026-06-01T10:00:00Z", body["scheduled_at"]
    refute body.key?("replyTo")
    refute body.key?("scheduledAt")
  end

  def test_create_accepts_idempotency_key
    set_response(body: { "id" => "bc_idem" })
    client.broadcasts.create({ from: "a@b.com", subject: "Hi" }, idempotency_key: "bc-idem-1")

    assert_equal "bc-idem-1", last_request.headers["idempotency-key"]
  end

  def test_list_with_filters
    set_response(body: { "object" => "list", "data" => [] })
    client.broadcasts.list(status: "sent", search: "may")

    assert_equal "GET", last_request.method
    assert_equal "/broadcasts", last_request.path
    assert_equal "sent", last_request.query["status"]
    assert_equal "may", last_request.query["search"]
  end

  def test_get_fetches_broadcast
    set_response(body: { "id" => "bc_1" })
    client.broadcasts.get("bc_1")

    assert_equal "/broadcasts/bc_1", last_request.path
  end

  def test_update_patches_broadcast
    set_response(body: { "id" => "bc_1" })
    client.broadcasts.update("bc_1", subject: "Updated subject")

    assert_equal "PATCH", last_request.method
    assert_equal "/broadcasts/bc_1", last_request.path
  end

  def test_delete_deletes_broadcast
    set_response(body: { "deleted" => true })
    client.broadcasts.delete("bc_1")

    assert_equal "DELETE", last_request.method
    assert_equal "/broadcasts/bc_1", last_request.path
  end

  def test_send_posts_to_broadcast_send
    set_response(body: { "object" => "broadcast", "id" => "bc_1", "status" => "queued" })
    client.broadcasts.send("bc_1")

    assert_equal "POST", last_request.method
    assert_equal "/broadcasts/bc_1/send", last_request.path
  end

  def test_send_broadcast_accepts_idempotency_key
    set_response(body: { "id" => "bc_1" })
    client.broadcasts.send("bc_1", {}, idempotency_key: "send-idem")

    assert_equal "send-idem", last_request.headers["idempotency-key"]
  end
end

# ===========================================================================
# Templates
# ===========================================================================
class TemplatesTest < Minitest::Test
  include TestServer

  def test_create_posts_to_templates
    set_response(body: { "object" => "template", "id" => "tmpl_1" })
    client.templates.create(name: "Welcome", html: "<h1>Hi</h1>")

    assert_equal "POST", last_request.method
    assert_equal "/templates", last_request.path
    assert_equal "Welcome", last_request.body["name"]
  end

  def test_create_normalises_camel_aliases
    set_response(body: { "object" => "template", "id" => "tmpl_1" })
    client.templates.create(name: "T", replyTo: "help@example.com", previewText: "preview")

    body = last_request.body
    assert_equal "help@example.com", body["reply_to"]
    assert_equal "preview", body["preview_text"]
    refute body.key?("replyTo")
  end

  def test_list_templates
    set_response(body: { "object" => "list", "data" => [] })
    client.templates.list(status: "published", search: "welcome")

    assert_equal "GET", last_request.method
    assert_equal "/templates", last_request.path
    assert_equal "published", last_request.query["status"]
  end

  def test_get_by_alias
    set_response(body: { "id" => "tmpl_1" })
    client.templates.get("welcome-email")

    assert_equal "/templates/welcome-email", last_request.path
  end

  def test_update_patches_template
    set_response(body: { "object" => "template", "id" => "tmpl_1" })
    client.templates.update("tmpl_1", name: "Updated")

    assert_equal "PATCH", last_request.method
    assert_equal "/templates/tmpl_1", last_request.path
  end

  def test_delete_deletes_template
    set_response(body: { "deleted" => true })
    client.templates.delete("tmpl_1")

    assert_equal "DELETE", last_request.method
    assert_equal "/templates/tmpl_1", last_request.path
  end

  def test_publish_posts_to_publish_path
    set_response(body: { "object" => "template", "id" => "tmpl_1" })
    client.templates.publish("tmpl_1")

    assert_equal "POST", last_request.method
    assert_equal "/templates/tmpl_1/publish", last_request.path
  end

  def test_duplicate_posts_to_duplicate_path
    set_response(body: { "object" => "template", "id" => "tmpl_2" })
    client.templates.duplicate("tmpl_1")

    assert_equal "POST", last_request.method
    assert_equal "/templates/tmpl_1/duplicate", last_request.path
  end
end

# ===========================================================================
# Automations
# ===========================================================================
class AutomationsTest < Minitest::Test
  include TestServer

  STEPS = [{ "key" => "trigger", "type" => "trigger" }, { "key" => "send", "type" => "send_email" }].freeze

  def test_create_posts_to_api_automations
    set_response(body: { "object" => "automation", "id" => "auto_1" })
    client.automations.create(name: "Welcome Flow", steps: STEPS)

    assert_equal "POST", last_request.method
    assert_equal "/api/automations", last_request.path
    assert_equal "Welcome Flow", last_request.body["name"]
  end

  def test_list_with_status_filter
    set_response(body: { "object" => "list", "data" => [] })
    client.automations.list(status: "enabled")

    assert_equal "GET", last_request.method
    assert_equal "/api/automations", last_request.path
    assert_equal "enabled", last_request.query["status"]
  end

  def test_get_fetches_automation
    set_response(body: { "object" => "automation", "id" => "auto_1" })
    client.automations.get("auto_1")

    assert_equal "/api/automations/auto_1", last_request.path
  end

  def test_update_patches_automation
    set_response(body: { "object" => "automation", "id" => "auto_1" })
    client.automations.update("auto_1", name: "Renamed")

    assert_equal "PATCH", last_request.method
    assert_equal "/api/automations/auto_1", last_request.path
  end

  def test_delete_deletes_automation
    set_response(body: { "object" => "automation", "id" => "auto_1", "deleted" => true })
    client.automations.delete("auto_1")

    assert_equal "DELETE", last_request.method
    assert_equal "/api/automations/auto_1", last_request.path
  end

  def test_list_runs
    set_response(body: { "object" => "list", "data" => [] })
    client.automations.list_runs("auto_1", status: "completed")

    assert_equal "GET", last_request.method
    assert_equal "/api/automations/auto_1/runs", last_request.path
    assert_equal "completed", last_request.query["status"]
  end

  def test_get_run
    set_response(body: { "object" => "automation_run", "id" => "run_1" })
    client.automations.get_run("auto_1", "run_1")

    assert_equal "GET", last_request.method
    assert_equal "/api/automations/auto_1/runs/run_1", last_request.path
  end

  def test_cancel_run
    set_response(body: { "object" => "automation_run", "id" => "run_1" })
    client.automations.cancel_run("auto_1", "run_1", reason: "User request")

    assert_equal "POST", last_request.method
    assert_equal "/api/automations/auto_1/runs/run_1/cancel", last_request.path
    assert_equal "User request", last_request.body["reason"]
  end

  def test_get_run_metrics
    set_response(body: { "object" => "automation_run_metrics" })
    client.automations.get_run_metrics("auto_1", from: "2026-01-01", to: "2026-05-01")

    assert_equal "GET", last_request.method
    assert_equal "/api/automations/auto_1/runs/metrics", last_request.path
    assert_equal "2026-01-01", last_request.query["from"]
    assert_equal "2026-05-01", last_request.query["to"]
  end
end

# ===========================================================================
# Events
# ===========================================================================
class EventsTest < Minitest::Test
  include TestServer

  def test_create_posts_to_api_events
    set_response(body: { "object" => "event", "id" => "evt_1" })
    client.events.create(name: "purchase")

    assert_equal "POST", last_request.method
    assert_equal "/api/events", last_request.path
    assert_equal "purchase", last_request.body["name"]
  end

  def test_list_events
    set_response(body: { "object" => "list", "data" => [] })
    client.events.list(limit: 5)

    assert_equal "GET", last_request.method
    assert_equal "/api/events", last_request.path
    assert_equal "5", last_request.query["limit"]
  end

  def test_send_event
    set_response(body: { "object" => "event_delivery" })
    client.events.send(event: "purchase", email: "user@example.com", payload: { amount: 99 })

    assert_equal "POST", last_request.method
    assert_equal "/api/events/send", last_request.path
    assert_equal "purchase", last_request.body["event"]
  end

  def test_send_event_normalises_contact_id_alias
    set_response(body: { "object" => "event_delivery" })
    client.events.send(event: "purchase", contactId: "contact_1")

    body = last_request.body
    assert_equal "contact_1", body["contact_id"]
    refute body.key?("contactId")
  end
end

# ===========================================================================
# Webhooks
# ===========================================================================
class WebhooksTest < Minitest::Test
  include TestServer

  def test_create_posts_to_api_webhooks
    set_response(body: { "object" => "webhook", "id" => "wh_1", "signing_secret" => "sec" })
    client.webhooks.create(endpoint: "https://hooks.example.com/ingest", events: ["email.sent"])

    assert_equal "POST", last_request.method
    assert_equal "/api/webhooks", last_request.path
    assert_equal "https://hooks.example.com/ingest", last_request.body["endpoint"]
  end

  def test_create_accepts_idempotency_key
    set_response(body: { "id" => "wh_idem" })
    client.webhooks.create({ endpoint: "https://hooks.example.com" }, idempotency_key: "wh-key")

    assert_equal "wh-key", last_request.headers["idempotency-key"]
  end

  def test_list_webhooks
    set_response(body: { "object" => "list", "data" => [] })
    client.webhooks.list(limit: 10)

    assert_equal "GET", last_request.method
    assert_equal "/api/webhooks", last_request.path
  end

  def test_get_webhook
    set_response(body: { "id" => "wh_1" })
    client.webhooks.get("wh_1")

    assert_equal "/api/webhooks/wh_1", last_request.path
  end

  def test_update_patches_webhook
    set_response(body: { "id" => "wh_1" })
    client.webhooks.update("wh_1", status: "disabled")

    assert_equal "PATCH", last_request.method
    assert_equal "/api/webhooks/wh_1", last_request.path
  end

  def test_delete_webhook
    set_response(body: { "deleted" => true })
    client.webhooks.delete("wh_1")

    assert_equal "DELETE", last_request.method
    assert_equal "/api/webhooks/wh_1", last_request.path
  end

  def test_list_deliveries
    set_response(body: { "object" => "list", "data" => [] })
    client.webhooks.list_deliveries("wh_1", limit: 5)

    assert_equal "GET", last_request.method
    assert_equal "/api/webhooks/wh_1/deliveries", last_request.path
    assert_equal "5", last_request.query["limit"]
  end

  def test_replay_delivery
    set_response(body: { "object" => "webhook_delivery_replay" })
    client.webhooks.replay_delivery("wh_1", "del_1")

    assert_equal "POST", last_request.method
    assert_equal "/api/webhooks/wh_1/deliveries/del_1/replay", last_request.path
  end
end

# ===========================================================================
# Topics
# ===========================================================================
class TopicsTest < Minitest::Test
  include TestServer

  def test_create_posts_to_api_topics
    set_response(body: { "object" => "topic", "id" => "topic_1" })
    client.topics.create(name: "Product Updates")

    assert_equal "POST", last_request.method
    assert_equal "/api/topics", last_request.path
    assert_equal "Product Updates", last_request.body["name"]
  end

  def test_create_normalises_default_subscription_alias
    set_response(body: { "id" => "topic_2" })
    client.topics.create(name: "T", defaultSubscription: "opt_in")

    body = last_request.body
    assert_equal "opt_in", body["default_subscription"]
    refute body.key?("defaultSubscription")
  end

  def test_list_topics
    set_response(body: { "object" => "list", "data" => [] })
    client.topics.list(search: "product")

    assert_equal "GET", last_request.method
    assert_equal "/api/topics", last_request.path
    assert_equal "product", last_request.query["search"]
  end

  def test_get_topic
    set_response(body: { "id" => "topic_1" })
    client.topics.get("topic_1")

    assert_equal "/api/topics/topic_1", last_request.path
  end

  def test_update_patches_topic
    set_response(body: { "id" => "topic_1" })
    client.topics.update("topic_1", name: "New Name")

    assert_equal "PATCH", last_request.method
    assert_equal "/api/topics/topic_1", last_request.path
  end

  def test_delete_topic
    set_response(body: { "success" => true })
    client.topics.delete("topic_1")

    assert_equal "DELETE", last_request.method
    assert_equal "/api/topics/topic_1", last_request.path
  end
end

# ===========================================================================
# Suppressions
# ===========================================================================
class SuppressionsTest < Minitest::Test
  include TestServer

  def test_list_suppressions
    set_response(body: { "object" => "list", "data" => [] })
    client.suppressions.list(limit: 20)

    assert_equal "GET", last_request.method
    assert_equal "/api/suppressions", last_request.path
    assert_equal "20", last_request.query["limit"]
  end

  def test_get_suppression_by_email
    set_response(body: { "id" => "sup_1", "email" => "bounce@example.com" })
    client.suppressions.get("bounce@example.com")

    assert_equal "GET", last_request.method
    assert_equal "/api/suppressions/bounce%40example.com", last_request.path
  end

  def test_create_suppression
    set_response(body: { "id" => "sup_1" })
    client.suppressions.create(email: "bad@example.com", reason: "bounce")

    assert_equal "POST", last_request.method
    assert_equal "/api/suppressions", last_request.path
    assert_equal "bad@example.com", last_request.body["email"]
  end

  def test_create_accepts_idempotency_key
    set_response(body: { "id" => "sup_2" })
    client.suppressions.create({ email: "x@y.com" }, idempotency_key: "sup-key")

    assert_equal "sup-key", last_request.headers["idempotency-key"]
  end

  def test_delete_suppression
    set_response(body: { "deleted" => true })
    client.suppressions.delete("bounce@example.com")

    assert_equal "DELETE", last_request.method
    assert_equal "/api/suppressions/bounce%40example.com", last_request.path
  end
end

# ===========================================================================
# Logs
# ===========================================================================
class LogsTest < Minitest::Test
  include TestServer

  def test_list_logs
    set_response(body: { "object" => "list", "data" => [] })
    client.logs.list(status: "200", method: "POST", limit: 25)

    assert_equal "GET", last_request.method
    assert_equal "/api/logs", last_request.path
    assert_equal "200", last_request.query["status"]
    assert_equal "POST", last_request.query["method"]
    assert_equal "25", last_request.query["limit"]
  end

  def test_get_log
    set_response(body: { "object" => "log", "id" => "log_1" })
    client.logs.get("log_1")

    assert_equal "GET", last_request.method
    assert_equal "/api/logs/log_1", last_request.path
  end
end

# ===========================================================================
# Module-level convenience API
# ===========================================================================
class ModuleLevelTest < Minitest::Test
  include TestServer

  def setup
    super
    OpenSend.api_key "os_test"
    OpenSend.base_url @base_url
  end

  def test_module_emails_send
    set_response(body: { "id" => "email_module" })
    result = OpenSend.emails.send(from: "a@b.com", to: "c@d.com", subject: "Hi")

    assert_equal "email_module", result["id"]
    assert_equal "/emails", last_request.path
  end

  def test_module_domains_list
    set_response(body: { "data" => [] })
    OpenSend.domains.list

    assert_equal "GET", last_request.method
    assert_equal "/api/domains", last_request.path
  end

  def test_module_contacts_create
    set_response(body: { "id" => "contact_m" })
    OpenSend.contacts.create(email: "m@example.com")

    assert_equal "/contacts", last_request.path
  end

  def test_module_broadcasts_send
    set_response(body: { "id" => "bc_m" })
    OpenSend.broadcasts.send("bc_m")

    assert_equal "POST", last_request.method
    assert_equal "/broadcasts/bc_m/send", last_request.path
  end

  def test_module_webhooks_list
    set_response(body: { "data" => [] })
    OpenSend.webhooks.list

    assert_equal "/api/webhooks", last_request.path
  end

  def test_module_suppressions_list
    set_response(body: { "data" => [] })
    OpenSend.suppressions.list

    assert_equal "/api/suppressions", last_request.path
  end

  def test_module_raises_without_api_key
    OpenSend.api_key = nil
    assert_raises(ArgumentError) { OpenSend.emails.send(from: "a@b.com") }
  end

  def test_classic_emails_module_send
    set_response(body: { "id" => "classic" })
    result = OpenSend::Emails.send(from: "a@b.com", to: "c@d.com", subject: "Hi")

    assert_equal "classic", result["id"]
  end
end

# ===========================================================================
# Original regression tests (preserved exactly, adapted to new harness)
# ===========================================================================
class OpenSendRubySdkTest < Minitest::Test
  include TestServer

  def test_default_base_url_targets_opensend_cloud
    assert_equal("https://opensend.namuh.co", OpenSend::DEFAULT_BASE_URL)
    assert_equal(OpenSend::DEFAULT_BASE_URL, OpenSend.base_url)

    c = OpenSend::Client.new(api_key: "os_default")
    assert_equal(OpenSend::DEFAULT_BASE_URL, c.base_url)
  end

  def test_module_level_send_serializes_payload_and_auth_header
    set_response(body: { "id" => "email_123" })
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
    set_response(body: { "id" => "email_123" })
    c = OpenSend::Client.new(api_key: "os_instance", base_url: "#{@base_url}/api/")

    response = c.emails.send(
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
    set_response(body: { "id" => "email_123" })
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
    set_response(
      status: 422,
      body: {
        "name" => "validation_error",
        "code" => "validation_error",
        "message" => "Validation failed.",
        "statusCode" => 422,
        "details" => { "fieldErrors" => { "to" => ["Required"] }, "formErrors" => [] }
      }
    )
    c = OpenSend::Client.new(api_key: "os_error", base_url: @base_url)

    error = assert_raises(OpenSend::Error) do
      c.emails.send(
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
