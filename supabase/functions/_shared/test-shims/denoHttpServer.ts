export type EdgeHandler = (req: Request) => Promise<Response> | Response;

let servedHandler: EdgeHandler | null = null;

export const serve = (handler: EdgeHandler): void => {
  servedHandler = handler;
};

export const __getServedHandler = (): EdgeHandler => {
  if (!servedHandler) {
    throw new Error("No edge handler has been registered");
  }

  return servedHandler;
};

export const __resetServedHandler = (): void => {
  servedHandler = null;
};
