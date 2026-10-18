import { resolve } from "node:path";

export function runtimeConfig(values, env = process.env, cwd = process.cwd()) {
  return {
    db:
      values.db ??
      env.CHATQUEST_DB ??
      env.BRANCHWRIGHT_DB ??
      resolve(cwd, ".branchwright/state.sqlite"),
    token: env.CHATQUEST_TOKEN ?? env.BRANCHWRIGHT_TOKEN,
    allowedHosts: (
      env.CHATQUEST_ALLOWED_HOSTS ??
      env.BRANCHWRIGHT_ALLOWED_HOSTS ??
      ""
    )
      .split(",")
      .filter(Boolean),
  };
}
