type AsyncResult<T> = Promise<T>;

type PutObjectInput = {
  Body?: unknown;
  Bucket?: string;
  ContentType?: string;
  Key?: string;
};

type HeadObjectInput = {
  Bucket?: string;
  Key?: string;
  VersionId?: string;
};

type GetObjectInput = {
  Bucket?: string;
  Key?: string;
  VersionId?: string;
};

type MockHandlers = {
  getObject: (input: GetObjectInput) => AsyncResult<Record<string, unknown>>;
  headObject: (input: HeadObjectInput) => AsyncResult<Record<string, unknown>>;
  putObject: (input: PutObjectInput) => AsyncResult<Record<string, unknown>>;
};

const unsupported = (commandName: string) => async () => {
  throw new Error(`No mock handler configured for ${commandName}`);
};

let handlers: MockHandlers = {
  getObject: unsupported("GetObjectCommand"),
  headObject: unsupported("HeadObjectCommand"),
  putObject: unsupported("PutObjectCommand"),
};

export class PutObjectCommand {
  readonly input: PutObjectInput;

  constructor(input: PutObjectInput) {
    this.input = input;
  }
}

export class HeadObjectCommand {
  readonly input: HeadObjectInput;

  constructor(input: HeadObjectInput) {
    this.input = input;
  }
}

export class GetObjectCommand {
  readonly input: GetObjectInput;

  constructor(input: GetObjectInput) {
    this.input = input;
  }
}

export class S3Client {
  constructor(_config?: Record<string, unknown>) {}

  send(command: PutObjectCommand | HeadObjectCommand | GetObjectCommand) {
    if (command instanceof PutObjectCommand) {
      return handlers.putObject(command.input);
    }

    if (command instanceof HeadObjectCommand) {
      return handlers.headObject(command.input);
    }

    if (command instanceof GetObjectCommand) {
      return handlers.getObject(command.input);
    }

    throw new Error("Unsupported mock S3 command");
  }
}

export const __setS3MockHandlers = (nextHandlers: Partial<MockHandlers>) => {
  handlers = {
    ...handlers,
    ...nextHandlers,
  };
};

export const __resetS3MockHandlers = () => {
  handlers = {
    getObject: unsupported("GetObjectCommand"),
    headObject: unsupported("HeadObjectCommand"),
    putObject: unsupported("PutObjectCommand"),
  };
};
