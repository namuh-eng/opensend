package com.opensend.fixtures;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.LinkedHashMap;
import java.util.Map;

public final class TestServer implements AutoCloseable {
  private final HttpServer server;
  private final Deque<RecordedRequest> requests = new ArrayDeque<>();
  private Handler handler = exchange -> new StubResponse(404, "{\"message\":\"not found\"}");

  public TestServer() throws IOException {
    this.server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
    this.server.createContext("/", this::handle);
    this.server.start();
  }

  public String url() {
    return "http://127.0.0.1:" + server.getAddress().getPort();
  }

  public void respond(Handler handler) {
    this.handler = handler;
  }

  public RecordedRequest takeRequest() {
    return requests.removeFirst();
  }

  private void handle(HttpExchange exchange) throws IOException {
    String body = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
    requests.addLast(new RecordedRequest(exchange.getRequestMethod(), exchange.getRequestURI().toString(), body, exchange.getRequestHeaders()));
    StubResponse response = handler.handle(exchange);
    for (Map.Entry<String, String> header : response.headers().entrySet()) {
      exchange.getResponseHeaders().set(header.getKey(), header.getValue());
    }
    byte[] bytes = response.body().getBytes(StandardCharsets.UTF_8);
    exchange.sendResponseHeaders(response.status(), bytes.length);
    exchange.getResponseBody().write(bytes);
    exchange.close();
  }

  @Override
  public void close() {
    server.stop(0);
  }

  public interface Handler {
    StubResponse handle(HttpExchange exchange) throws IOException;
  }

  public record StubResponse(int status, String body, Map<String, String> headers) {
    public StubResponse(int status, String body) {
      this(status, body, new LinkedHashMap<>());
    }
  }
}
