const DEFAULT_APP_URL = "https://coparrent.com";

export const getAppUrl = (): string => {
  const configuredAppUrl =
    Deno.env.get("APP_URL") ??
    Deno.env.get("PUBLIC_APP_URL") ??
    Deno.env.get("SITE_URL");

  return (configuredAppUrl || DEFAULT_APP_URL).replace(/\/+$/, "");
};

export const buildAppUrl = (path: string = "/"): string => {
  return new URL(path, `${getAppUrl()}/`).toString();
};
