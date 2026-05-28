package com.opensend.resources;

import com.fasterxml.jackson.core.type.TypeReference;
import com.opensend.ListPage;
import com.opensend.OpenSendResponse;
import com.opensend.RequestOptions;
import com.opensend.internal.HttpTransport;
import com.opensend.internal.Query;
import com.opensend.models.BatchEmailResponse;
import com.opensend.models.CancelEmailResponse;
import com.opensend.models.EmailDetailResponse;
import com.opensend.models.EmailListItem;
import com.opensend.models.EmailListOptions;
import com.opensend.models.EmailResponse;
import com.opensend.models.SendEmailRequest;
import java.util.List;

public final class EmailsClient {
  private final HttpTransport transport;

  public EmailsClient(HttpTransport transport) {
    this.transport = transport;
  }

  public EmailResponse send(SendEmailRequest request) {
    return send(request, RequestOptions.none());
  }

  public EmailResponse send(SendEmailRequest request, RequestOptions options) {
    return sendWithResponse(request, options).data();
  }

  public OpenSendResponse<EmailResponse> sendWithResponse(SendEmailRequest request, RequestOptions options) {
    return transport.response("POST", "/emails", request, options, new TypeReference<EmailResponse>() {});
  }

  public BatchEmailResponse sendBatch(List<SendEmailRequest> requests) {
    return sendBatch(requests, RequestOptions.none());
  }

  public BatchEmailResponse sendBatch(List<SendEmailRequest> requests, RequestOptions options) {
    return transport.json("POST", "/emails/batch", requests, options, new TypeReference<BatchEmailResponse>() {});
  }

  public ListPage<EmailListItem> list() {
    return list(EmailListOptions.empty());
  }

  public ListPage<EmailListItem> list(EmailListOptions options) {
    EmailListOptions safe = options == null ? EmailListOptions.empty() : options;
    String path = new Query("/api/emails")
        .add("limit", safe.limit())
        .add("after", safe.after())
        .add("before", safe.before())
        .add("status", safe.status())
        .build();
    return transport.json("GET", path, null, RequestOptions.none(), new TypeReference<ListPage<EmailListItem>>() {});
  }

  public EmailDetailResponse get(String id) {
    return transport.json("GET", "/api/emails/" + id, null, RequestOptions.none(), new TypeReference<EmailDetailResponse>() {});
  }

  public CancelEmailResponse cancel(String id) {
    return transport.json("POST", "/emails/" + id + "/cancel", null, RequestOptions.none(), new TypeReference<CancelEmailResponse>() {});
  }
}
