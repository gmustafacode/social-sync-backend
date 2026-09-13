type ClassValue = string | number | boolean | null | undefined | ClassValue[] | Record<string, boolean | null | undefined>

export function cn(...inputs: ClassValue[]) {
  return (inputs as unknown[])
    .flat(Infinity)
    .filter((value): value is string | number => typeof value === "string" || typeof value === "number")
    .join(" ")
}

export function getBaseUrl() {
  if (typeof window !== "undefined") return window.location.origin;
  const env = (globalThis as typeof globalThis & {
    process?: { env?: Record<string, string | undefined> }
  }).process?.env;
  if (env?.NEXT_PUBLIC_APP_URL) return env.NEXT_PUBLIC_APP_URL;
  if (env?.NEXTAUTH_URL) return env.NEXTAUTH_URL;
  return "https://newproject-chi-gold.vercel.app";
}
