/** Bound the actual stream, including chunked requests without Content-Length. */
export class RequestBodyError extends Error {
  constructor(public status: number) {
    super(status === 413 ? "Request body too large" : "Invalid request body");
  }
}

export async function readBoundedBody(
  request: Request,
  maxBytes: number,
  timeoutMs = 30_000,
): Promise<Uint8Array<ArrayBuffer>> {
  const length = request.headers.get("content-length");
  if (length && (!/^\d+$/.test(length) || Number(length) > maxBytes)) {
    throw new RequestBodyError(413);
  }
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new RequestBodyError(408)), timeoutMs);
  });
  try {
    while (true) {
      const { value, done } = await Promise.race([reader.read(), timeout]);
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) throw new RequestBodyError(413);
      chunks.push(value);
    }
    const result = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return result;
  } catch (error) {
    void reader.cancel().catch(() => {});
    throw error;
  } finally {
    clearTimeout(timer);
    reader.releaseLock();
  }
}

export async function readJsonObject(request: Request): Promise<Record<string, unknown>> {
  const bytes = await readBoundedBody(request, 64 * 1024);
  try {
    const value: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error();
    return value as Record<string, unknown>;
  } catch {
    throw new RequestBodyError(400);
  }
}

export async function readUploadForm(request: Request): Promise<FormData> {
  // Ten 8 MiB images plus multipart headers. Per-file limits also apply.
  const bytes = await readBoundedBody(request, 81 * 1024 * 1024);
  try {
    return await new Response(bytes, {
      headers: { "Content-Type": request.headers.get("content-type") ?? "" },
    }).formData();
  } catch {
    throw new RequestBodyError(400);
  }
}

export function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}
