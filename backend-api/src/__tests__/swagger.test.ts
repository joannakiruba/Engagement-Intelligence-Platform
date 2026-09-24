import swaggerDocument from "../swagger/swagger.json";

describe("OpenAPI / Swagger specification", () => {
  it("has required OpenAPI version", () => {
    expect(swaggerDocument.openapi).toBe("3.0.3");
  });

  it("has info block with title and version", () => {
    expect(swaggerDocument.info).toBeDefined();
    expect(swaggerDocument.info.title).toBeTruthy();
    expect(swaggerDocument.info.version).toBeTruthy();
  });

  it("defines at least one server", () => {
    expect(swaggerDocument.servers.length).toBeGreaterThanOrEqual(1);
  });

  it("defines BearerAuth security scheme", () => {
    const scheme = swaggerDocument.components?.securitySchemes?.BearerAuth;
    expect(scheme).toBeDefined();
    expect(scheme.type).toBe("http");
    expect(scheme.scheme).toBe("bearer");
  });

  it("has all 8 tags", () => {
    const tagNames = swaggerDocument.tags.map((t: { name: string }) => t.name);
    expect(tagNames).toEqual(
      expect.arrayContaining([
        "Auth",
        "Users",
        "Batches",
        "Sessions",
        "Assessments",
        "Attendance",
        "Feedback",
        "Mentor Assignments",
      ])
    );
  });

  it("defines paths for all major route groups", () => {
    const paths = Object.keys(swaggerDocument.paths);
    const groups = ["/auth/login", "/users/me", "/api/batches", "/api/sessions", "/api/assessments", "/api/attendance", "/api/feedback", "/api/mentor-assignments"];

    for (const group of groups) {
      const found = paths.some((p) => p.startsWith(group));
      expect(found).toBe(true);
    }
  });

  it("every path operation has a summary or operationId", () => {
    const methods = ["get", "post", "put", "patch", "delete"] as const;

    for (const [path, def] of Object.entries(swaggerDocument.paths)) {
      for (const method of methods) {
        const op = (def as Record<string, any>)[method];
        if (op) {
          const hasMeta = op.summary || op.operationId;
          expect(hasMeta).toBeTruthy();
        }
      }
    }
  });

  it("references only defined component schemas", () => {
    const definedSchemas = Object.keys(swaggerDocument.components?.schemas ?? {});
    const raw = JSON.stringify(swaggerDocument.paths);
    const refRegex = /#\/components\/schemas\/([A-Za-z0-9_]+)/g;
    let match: RegExpExecArray | null;
    const referenced = new Set<string>();

    while ((match = refRegex.exec(raw)) !== null) {
      referenced.add(match[1]);
    }

    for (const ref of referenced) {
      expect(definedSchemas).toContain(ref);
    }
  });

  it("defines response schemas for core models", () => {
    const schemas = Object.keys(swaggerDocument.components?.schemas ?? {});
    const expected = ["User", "Batch", "Session", "Attendance", "Feedback", "MentorAssignment"];

    for (const name of expected) {
      expect(schemas).toContain(name);
    }
  });
});
