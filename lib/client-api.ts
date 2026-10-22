declare const __LITRIC_API_URL__: string;
export const isPages = true;
export const backendOrigin =
  typeof __LITRIC_API_URL__ !== "undefined" ? __LITRIC_API_URL__ : "";
let sessionToken = "";
let expiry: ReturnType<typeof setTimeout> | undefined;
export function disconnectBackend() {
  sessionToken = "";
  if (expiry) clearTimeout(expiry);
  if (typeof window !== "undefined")
    window.dispatchEvent(new Event("litric:disconnected"));
}
async function authCall(path: string, body: any) {
  const response = await fetch(backendOrigin + "/api/auth/" + path, {
    method: "POST",
    credentials: "omit",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      ...(sessionToken ? { Authorization: "Bearer " + sessionToken } : {}),
    },
    body: JSON.stringify(body),
  });
  const result: any = await response.json();
  if (!response.ok)
    throw Object.assign(new Error(result.error || "Log masuk tidak berjaya."), {
      status: response.status,
    });
  return result;
}
export async function login(username: string, password: string) {
  const result = await authCall("login", { username, password });
  sessionToken = result.token;
  if (expiry) clearTimeout(expiry);
  expiry = setTimeout(
    disconnectBackend,
    Math.max(0, result.expiresAt - Date.now()),
  );
  return result;
}
export async function changePassword(
  currentPassword: string,
  password: string,
) {
  const result = await authCall("password", { currentPassword, password });
  disconnectBackend();
  return result;
}
export async function logout() {
  try {
    await authCall("logout", {});
  } finally {
    disconnectBackend();
  }
}
export async function apiFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  if (!/^\/api\/[a-z0-9/-]+(?:\?[^#]*)?$/.test(path))
    throw new Error("Laluan API tidak dibenarkan.");
  if (!sessionToken)
    throw Object.assign(
      new Error("Sila log masuk menggunakan akaun sekolah."),
      { status: 401 },
    );
  const headers = new Headers(init.headers);
  headers.set("Authorization", "Bearer " + sessionToken);
  const response = await fetch(backendOrigin + path, {
    ...init,
    headers,
    credentials: "omit",
    cache: "no-store",
    redirect: "error",
  });
  if (response.status === 401) disconnectBackend();
  return response;
}
export async function downloadProtected(path: string) {
  const response = await apiFetch(path);
  if (!response.ok)
    throw new Error(
      ((await response.json()) as any).error || "Muat turun gagal.",
    );
  const url = URL.createObjectURL(await response.blob()),
    a = document.createElement("a");
  a.href = url;
  a.download =
    response.headers
      .get("Content-Disposition")
      ?.match(/filename="([^"]+)"/)?.[1] || "LITRIC-fail";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
