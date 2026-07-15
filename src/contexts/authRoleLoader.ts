export type RoleRpcResult = {
  data: unknown;
  error: unknown;
};

type RoleRpcRequest = () => PromiseLike<RoleRpcResult>;
type Wait = (delayMs: number) => Promise<void>;

const defaultWait: Wait = (delayMs) =>
  new Promise((resolve) => {
    window.setTimeout(resolve, delayMs);
  });

const errorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    return String(error.message);
  }
  return String(error ?? "");
};

export const isTransientRoleFetchError = (error: unknown): boolean =>
  /failed to fetch|fetch failed|networkerror|network request failed|load failed/i.test(
    errorMessage(error),
  );

export const loadRolesWithTransientRetry = async (
  request: RoleRpcRequest,
  wait: Wait = defaultWait,
): Promise<unknown> => {
  const maxAttempts = 2;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const { data, error } = await request();
    if (!error) return data;

    if (attempt < maxAttempts && isTransientRoleFetchError(error)) {
      await wait(250);
      continue;
    }

    throw error;
  }

  return null;
};

export const roleLoadErrorMessage = (error: unknown): string =>
  errorMessage(error) || "Role setup failed";
