package com.opensend.resources;

import com.fasterxml.jackson.core.type.TypeReference;
import com.opensend.ListPage;
import com.opensend.RequestOptions;
import com.opensend.internal.HttpTransport;
import com.opensend.models.CreateDomainRequest;
import com.opensend.models.DeleteDomainResponse;
import com.opensend.models.DomainListItem;
import com.opensend.models.DomainMutationResponse;
import com.opensend.models.DomainResponse;
import com.opensend.models.UpdateDomainRequest;

public final class DomainsClient {
  private final HttpTransport transport;

  public DomainsClient(HttpTransport transport) {
    this.transport = transport;
  }

  public DomainResponse create(CreateDomainRequest request) {
    return transport.json("POST", "/api/domains", request, RequestOptions.none(), new TypeReference<DomainResponse>() {});
  }

  public ListPage<DomainListItem> list() {
    return transport.json("GET", "/api/domains", null, RequestOptions.none(), new TypeReference<ListPage<DomainListItem>>() {});
  }

  public DomainResponse get(String id) {
    return transport.json("GET", "/api/domains/" + id, null, RequestOptions.none(), new TypeReference<DomainResponse>() {});
  }

  public DomainMutationResponse update(String id, UpdateDomainRequest request) {
    return transport.json("PATCH", "/api/domains/" + id, request, RequestOptions.none(), new TypeReference<DomainMutationResponse>() {});
  }

  public DomainResponse verify(String id) {
    return transport.json("POST", "/api/domains/" + id + "/verify", null, RequestOptions.none(), new TypeReference<DomainResponse>() {});
  }

  public DeleteDomainResponse delete(String id) {
    return transport.json("DELETE", "/api/domains/" + id, null, RequestOptions.none(), new TypeReference<DeleteDomainResponse>() {});
  }
}
