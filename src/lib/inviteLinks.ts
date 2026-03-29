export interface ParsedInviteLink {
  token: string;
  type: "co_parent" | "third_party" | null;
}

export const parseInviteLink = (input: string): ParsedInviteLink | null => {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const parseTokenAndType = (params: URLSearchParams): ParsedInviteLink | null => {
    const token = params.get("token")?.trim();
    if (!token) return null;

    const rawType = params.get("type")?.trim();
    return {
      token,
      type: rawType === "third_party" ? "third_party" : rawType === "co_parent" ? "co_parent" : null,
    };
  };

  if (/^[a-z0-9-]{16,}$/i.test(trimmed)) {
    return { token: trimmed, type: null };
  }

  try {
    const asUrl = new URL(trimmed);
    return parseTokenAndType(asUrl.searchParams);
  } catch {
    try {
      const asParams = new URLSearchParams(trimmed.startsWith("?") ? trimmed.slice(1) : trimmed);
      return parseTokenAndType(asParams);
    } catch {
      return null;
    }
  }
};
