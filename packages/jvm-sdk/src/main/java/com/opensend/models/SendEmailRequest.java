package com.opensend.models;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;
import java.util.Map;

public record SendEmailRequest(
    @JsonProperty("from") String from,
    List<String> to,
    String subject,
    String html,
    String text,
    List<String> cc,
    List<String> bcc,
    @JsonProperty("reply_to") List<String> replyTo,
    Map<String, String> headers,
    List<EmailAttachment> attachments,
    List<EmailTag> tags,
    @JsonProperty("scheduled_at") String scheduledAt,
    @JsonProperty("topic_id") String topicId,
    EmailTemplateReference template) {
  public static Builder builder() {
    return new Builder();
  }

  public static final class Builder {
    private String from;
    private List<String> to;
    private String subject;
    private String html;
    private String text;
    private List<String> cc;
    private List<String> bcc;
    private List<String> replyTo;
    private Map<String, String> headers;
    private List<EmailAttachment> attachments;
    private List<EmailTag> tags;
    private String scheduledAt;
    private String topicId;
    private EmailTemplateReference template;

    public Builder from(String from) { this.from = from; return this; }
    public Builder to(List<String> to) { this.to = to; return this; }
    public Builder subject(String subject) { this.subject = subject; return this; }
    public Builder html(String html) { this.html = html; return this; }
    public Builder text(String text) { this.text = text; return this; }
    public Builder cc(List<String> cc) { this.cc = cc; return this; }
    public Builder bcc(List<String> bcc) { this.bcc = bcc; return this; }
    public Builder replyTo(List<String> replyTo) { this.replyTo = replyTo; return this; }
    public Builder headers(Map<String, String> headers) { this.headers = headers; return this; }
    public Builder attachments(List<EmailAttachment> attachments) { this.attachments = attachments; return this; }
    public Builder tags(List<EmailTag> tags) { this.tags = tags; return this; }
    public Builder scheduledAt(String scheduledAt) { this.scheduledAt = scheduledAt; return this; }
    public Builder topicId(String topicId) { this.topicId = topicId; return this; }
    public Builder template(EmailTemplateReference template) { this.template = template; return this; }

    public SendEmailRequest build() {
      return new SendEmailRequest(from, to, subject, html, text, cc, bcc, replyTo, headers, attachments, tags, scheduledAt, topicId, template);
    }
  }
}
