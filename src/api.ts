export type Files = Record<string, string>;
export type User = { id: string; name: string; email: string };
export type Project = {
  id: string;
  name: string;
  revision: number;
  files: Files;
  image: string | null;
  updated_at: string;
  created_at: string;
};
export type Proposal = {
  id: string;
  summary: string;
  questions: string[];
  files: Files;
  revision: number;
  buildError: string | null;
};
export type Message = { id: string; role: string; content: string };
export async function api<T = any>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const response = await fetch("/api" + path, {
    method,
    credentials: "same-origin",
    headers: method === "GET" ? {} : { "Content-Type": "application/json" },
    body:
      body === undefined
        ? method === "GET"
          ? undefined
          : "{}"
        : JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
}
