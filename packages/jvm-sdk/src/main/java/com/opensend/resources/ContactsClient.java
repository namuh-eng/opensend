package com.opensend.resources;

import com.fasterxml.jackson.core.type.TypeReference;
import com.opensend.ListOptions;
import com.opensend.ListPage;
import com.opensend.RequestOptions;
import com.opensend.internal.HttpTransport;
import com.opensend.internal.Query;
import com.opensend.models.ContactResponse;
import com.opensend.models.CreateContactRequest;
import com.opensend.models.DeleteContactResponse;
import com.opensend.models.UpdateContactRequest;

public final class ContactsClient {
  private final HttpTransport transport;

  public ContactsClient(HttpTransport transport) {
    this.transport = transport;
  }

  public ContactResponse create(CreateContactRequest request) {
    return transport.json("POST", "/contacts", request, RequestOptions.none(), new TypeReference<ContactResponse>() {});
  }

  public ListPage<ContactResponse> list() {
    return list(ListOptions.empty());
  }

  public ListPage<ContactResponse> list(ListOptions options) {
    ListOptions safe = options == null ? ListOptions.empty() : options;
    String path = new Query("/contacts")
        .add("limit", safe.limit())
        .add("after", safe.after())
        .build();
    return transport.json("GET", path, null, RequestOptions.none(), new TypeReference<ListPage<ContactResponse>>() {});
  }

  public ContactResponse get(String idOrEmail) {
    return transport.json("GET", "/contacts/" + idOrEmail, null, RequestOptions.none(), new TypeReference<ContactResponse>() {});
  }

  public ContactResponse update(String idOrEmail, UpdateContactRequest request) {
    return transport.json("PATCH", "/contacts/" + idOrEmail, request, RequestOptions.none(), new TypeReference<ContactResponse>() {});
  }

  public DeleteContactResponse delete(String idOrEmail) {
    return transport.json("DELETE", "/contacts/" + idOrEmail, null, RequestOptions.none(), new TypeReference<DeleteContactResponse>() {});
  }
}
