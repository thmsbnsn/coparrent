import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "npm:@aws-sdk/client-s3";

export type CourtExportStorageProvider = "aws_s3_object_lock";

export interface ImmutableCourtExportObject {
  bucket: string;
  bytes: Uint8Array;
  contentType: string;
  key: string;
  objectLockMode: string;
  provider: CourtExportStorageProvider;
  retainUntil: string;
  versionId: string;
}

interface AwsCourtExportConfig {
  accessKeyId: string;
  bucketName: string;
  region: string;
  secretAccessKey: string;
}

let cachedConfig: AwsCourtExportConfig | null = null;
let cachedClient: S3Client | null = null;

const asNonEmpty = (value: string | null | undefined) => {
  const normalized = value?.trim();
  return normalized ? normalized : null;
};

const getAwsCourtExportConfig = (): AwsCourtExportConfig => {
  if (cachedConfig) {
    return cachedConfig;
  }

  const accessKeyId =
    asNonEmpty(Deno.env.get("AWS_ACCESS_KEY_ID")) ??
    asNonEmpty(Deno.env.get("AWS_ACCESS_KEY"));
  const secretAccessKey = asNonEmpty(Deno.env.get("AWS_SECRET_ACCESS_KEY"));
  const region = asNonEmpty(Deno.env.get("AWS_REGION"));
  const bucketName = asNonEmpty(Deno.env.get("AWS_S3_BUCKET_NAME"));

  if (!accessKeyId || !secretAccessKey || !region || !bucketName) {
    throw new Error("AWS court-export storage is not fully configured.");
  }

  cachedConfig = {
    accessKeyId,
    bucketName,
    region,
    secretAccessKey,
  };
  return cachedConfig;
};

const getS3Client = () => {
  if (cachedClient) {
    return cachedClient;
  }

  const config = getAwsCourtExportConfig();
  cachedClient = new S3Client({
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    region: config.region,
  });

  return cachedClient;
};

const readS3BodyToBytes = async (body: unknown): Promise<Uint8Array> => {
  if (!body) {
    throw new Error("S3 object body is unavailable.");
  }

  if (body instanceof Uint8Array) {
    return body;
  }

  if (ArrayBuffer.isView(body)) {
    return new Uint8Array(
      body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength),
    );
  }

  if (body instanceof ArrayBuffer) {
    return new Uint8Array(body);
  }

  if (typeof (body as { transformToByteArray?: () => Promise<Uint8Array> }).transformToByteArray === "function") {
    return await (body as { transformToByteArray: () => Promise<Uint8Array> }).transformToByteArray();
  }

  if (typeof (body as { arrayBuffer?: () => Promise<ArrayBuffer> }).arrayBuffer === "function") {
    const buffer = await (body as { arrayBuffer: () => Promise<ArrayBuffer> }).arrayBuffer();
    return new Uint8Array(buffer);
  }

  if (body instanceof ReadableStream) {
    const reader = body.getReader();
    const chunks: Uint8Array[] = [];
    let totalBytes = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      if (value) {
        chunks.push(value);
        totalBytes += value.byteLength;
      }
    }

    const combined = new Uint8Array(totalBytes);
    let offset = 0;
    for (const chunk of chunks) {
      combined.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return combined;
  }

  throw new Error("Unsupported S3 object body type.");
};

const normalizeObjectLockMode = (value: unknown) => {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toUpperCase();
  return normalized ? normalized : null;
};

const normalizeRetainUntil = (value: unknown) => {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }

  return null;
};

export const getCourtExportObjectLockBucketName = () =>
  getAwsCourtExportConfig().bucketName;

export const uploadImmutableCourtExportObject = async (options: {
  bytes: Uint8Array;
  contentType: string;
  key: string;
}) => {
  const client = getS3Client();
  const config = getAwsCourtExportConfig();

  const putResult = await client.send(
    new PutObjectCommand({
      Body: options.bytes,
      Bucket: config.bucketName,
      ContentType: options.contentType,
      Key: options.key,
    }),
  );

  const versionId =
    typeof putResult.VersionId === "string" ? putResult.VersionId : null;
  if (!versionId) {
    throw new Error("Immutable S3 upload did not return a version ID.");
  }

  const headResult = await client.send(
    new HeadObjectCommand({
      Bucket: config.bucketName,
      Key: options.key,
      VersionId: versionId,
    }),
  );

  const objectLockMode = normalizeObjectLockMode(headResult.ObjectLockMode);
  const retainUntil = normalizeRetainUntil(headResult.ObjectLockRetainUntilDate);

  if (!objectLockMode || !retainUntil) {
    throw new Error("Immutable S3 upload did not expose Object Lock retention metadata.");
  }

  return {
    bucket: config.bucketName,
    bytes: options.bytes,
    contentType: options.contentType,
    key: options.key,
    objectLockMode,
    provider: "aws_s3_object_lock" as const,
    retainUntil,
    versionId,
  } satisfies ImmutableCourtExportObject;
};

export const downloadImmutableCourtExportObject = async (options: {
  bucket?: string | null;
  key: string;
  versionId: string;
}) => {
  const client = getS3Client();
  const bucket = asNonEmpty(options.bucket) ?? getAwsCourtExportConfig().bucketName;

  const response = await client.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: options.key,
      VersionId: options.versionId,
    }),
  );

  const contentType =
    typeof response.ContentType === "string"
      ? response.ContentType
      : "application/octet-stream";

  return {
    bucket,
    bytes: await readS3BodyToBytes(response.Body),
    contentType,
    key: options.key,
    objectLockMode: normalizeObjectLockMode(response.ObjectLockMode) ?? "COMPLIANCE",
    provider: "aws_s3_object_lock" as const,
    retainUntil:
      normalizeRetainUntil(response.ObjectLockRetainUntilDate) ??
      new Date(0).toISOString(),
    versionId: options.versionId,
  } satisfies ImmutableCourtExportObject;
};
