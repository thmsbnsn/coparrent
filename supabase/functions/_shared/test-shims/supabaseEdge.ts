type CreateClientImplementation = (...args: unknown[]) => unknown;

const defaultImplementation: CreateClientImplementation = () => {
  throw new Error("Mock createClient implementation has not been configured");
};

let implementation: CreateClientImplementation = defaultImplementation;

export const createClient = (...args: unknown[]) => implementation(...args);

export const __setCreateClientImplementation = (nextImplementation: CreateClientImplementation): void => {
  implementation = nextImplementation;
};

export const __resetCreateClientImplementation = (): void => {
  implementation = defaultImplementation;
};
