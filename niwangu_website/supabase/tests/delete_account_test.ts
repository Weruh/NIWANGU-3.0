// Mocked Auth/Storage responses; no real accounts or network requests.
const assert = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message);
};
let handler: (request: Request) => Promise<Response>;
const originalServe = Deno.serve;
Object.defineProperty(Deno, "serve", {
  value: (callback: typeof handler) => {
    handler = callback;
    return {};
  },
  configurable: true,
});
Deno.env.set("SUPABASE_URL", "https://review.supabase.test");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "review-service");
await import("../functions/delete-account/index.ts");
Object.defineProperty(Deno, "serve", {
  value: originalServe,
  configurable: true,
});
const originalFetch = globalThis.fetch;
const request = () =>
  new Request("https://review.test/delete-account", {
    method: "POST",
    headers: { authorization: "Bearer review-token" },
  });
Deno.test("invalid session cannot delete an account", async () => {
  let deletes = 0;
  globalThis.fetch = async (input) => {
    if (String(input).includes("/admin/users/")) deletes++;
    return Response.json({ message: "Invalid token" }, { status: 401 });
  };
  try {
    assert((await handler(request())).status === 401, "reject invalid session");
    assert(deletes === 0, "must not delete");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
Deno.test(
  "deletion removes tracked and orphaned photos before Auth user",
  async () => {
    const removed: string[] = [];
    let lists = 0;
    let deleted = false;
    globalThis.fetch = async (input, init) => {
      const url = String(input);
      if (url.endsWith("/auth/v1/user"))
        return Response.json({ id: "60000000-0000-4000-8000-000000000001" });
      if (url.includes("/auth/v1/logout"))
        return new Response(null, { status: 204 });
      if (url.includes("/rest/v1/profiles?"))
        return Response.json({ id: "review-profile" });
      if (url.includes("/rest/v1/profile_photos?"))
        return Response.json([
          { storage_path: "60000000-0000-4000-8000-000000000001/tracked.jpg" },
        ]);
      if (url.includes("/storage/v1/object/list/"))
        return Response.json(
          lists++ === 0 ? [{ name: "orphan.jpg", id: "orphan" }] : [],
        );
      if (url.includes("/storage/v1/object/profile-photos")) {
        removed.push(...JSON.parse(String(init?.body)).prefixes);
        return Response.json([]);
      }
      if (
        url.includes(
          "/auth/v1/admin/users/60000000-0000-4000-8000-000000000001",
        )
      ) {
        assert(
          removed.includes("60000000-0000-4000-8000-000000000001/tracked.jpg"),
          "tracked photo removed first",
        );
        assert(
          removed.includes("60000000-0000-4000-8000-000000000001/orphan.jpg"),
          "orphan removed first",
        );
        deleted = true;
        return Response.json({});
      }
      throw new Error(`Unexpected request ${url}`);
    };
    try {
      assert((await handler(request())).status === 200, "deletion succeeds");
      assert(deleted, "Auth user deleted");
    } finally {
      globalThis.fetch = originalFetch;
    }
  },
);
Deno.test(
  "storage failure leaves Auth account available for retry",
  async () => {
    let deleted = false;
    globalThis.fetch = async (input) => {
      const url = String(input);
      if (url.endsWith("/auth/v1/user"))
        return Response.json({ id: "60000000-0000-4000-8000-000000000001" });
      if (url.includes("/auth/v1/logout"))
        return new Response(null, { status: 204 });
      if (url.includes("/rest/v1/profiles?")) return Response.json(null);
      if (url.includes("/storage/v1/object/list/"))
        return Response.json(
          { message: "Storage unavailable" },
          { status: 503 },
        );
      if (url.includes("/auth/v1/admin/users/")) deleted = true;
      throw new Error("Unexpected request");
    };
    try {
      assert((await handler(request())).status === 500, "retryable failure");
      assert(!deleted, "must not delete before Storage cleanup");
    } finally {
      globalThis.fetch = originalFetch;
    }
  },
);
