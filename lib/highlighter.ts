import { SnippetKind } from "./types";

export interface SyntaxToken {
  type: "keyword" | "string" | "comment" | "function" | "number" | "property" | "plain";
  text: string;
}

// 언어 자동 판별
export function detectSnippetKind(code: string): SnippetKind {
  const trimmed = code.trim();
  if (!trimmed) return "text";

  const lines = trimmed.split("\n");
  const firstNonEmptyLine = lines.find((l) => l.trim().length > 0)?.trim() || "";

  // 1. XML: 줄머리가 <
  if (firstNonEmptyLine.startsWith("<")) {
    return "xml";
  }

  // 2. Python: import, from, def, class, self.
  const pythonKeywords = /\b(import|from|def|class|self\.)\b/;
  if (pythonKeywords.test(code)) {
    return "python";
  }

  // 3. Bash: $ , ros2 , colcon , sudo , cd , source , export , apt 
  const bashKeywords = /(?:^|\n|\s)(?:\$|ros2|colcon|sudo|cd|source|export|apt)\s+/;
  if (bashKeywords.test(code) || /^\s*\$\s+/m.test(code)) {
    return "bash";
  }

  // 4. YAML: 키: 값 형태가 여러 줄 있는 경우
  const yamlKeyValueCount = lines.filter((line) => {
    const l = line.trim();
    return !l.startsWith("#") && /^[a-zA-Z0-9_-]+\s*:\s*.+/.test(l);
  }).length;

  if (yamlKeyValueCount >= 2 || (yamlKeyValueCount >= 1 && lines.length <= 3)) {
    return "yaml";
  }

  return "text";
}

// 다음 종류 순환 (클릭 시 순환)
export function getNextSnippetKind(current: SnippetKind): SnippetKind {
  const kinds: SnippetKind[] = ["python", "bash", "xml", "yaml", "text"];
  const idx = kinds.indexOf(current);
  return kinds[(idx + 1) % kinds.length];
}

// 종류별 뱃지 스타일 및 한글 라벨
export function getKindBadgeInfo(kind: SnippetKind): { label: string; bg: string; text: string } {
  switch (kind) {
    case "python":
      return { label: "Python", bg: "#F4F4F5", text: "#3F3F46" };
    case "bash":
      return { label: "Terminal", bg: "#FFEDD5", text: "#7C2D12" };
    case "xml":
      return { label: "XML", bg: "#DBEAFE", text: "#1E3A8A" };
    case "yaml":
      return { label: "YAML", bg: "#FEF3C7", text: "#78350F" };
    default:
      return { label: "Text", bg: "#F4F4F5", text: "#52525B" };
  }
}

// 토큰 정규식 - 텍스트 원본 보존 보장 (외부 라이브러리 없음)
// 문법 색:
// 예약어: #C792EA
// 문자열: #C3E88D
// 주석: #7A8290
// 함수: #82AAFF
// 숫자: #F78C6C
// 속성: #FFCB6B

export function tokenizeCode(code: string, kind: SnippetKind): SyntaxToken[][] {
  const lines = code.split("\n");
  return lines.map((line) => tokenizeLine(line, kind));
}

function tokenizeLine(line: string, kind: SnippetKind): SyntaxToken[] {
  if (kind === "text" || !line) {
    return [{ type: "plain", text: line }];
  }

  const tokens: SyntaxToken[] = [];
  let remaining = line;

  // 언어별 정규식 패턴 정의
  let patterns: { type: SyntaxToken["type"]; regex: RegExp }[] = [];

  if (kind === "python") {
    patterns = [
      { type: "comment", regex: /^#.*/ },
      { type: "string", regex: /^(?:"""[\s\S]*?"""|'''[\s\S]*?'''|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/ },
      { type: "keyword", regex: /^\b(?:def|class|if|elif|else|for|while|try|except|finally|return|import|from|as|with|in|is|not|and|or|lambda|yield|raise|pass|break|continue|None|True|False|self)\b/ },
      { type: "function", regex: /^\b([a-zA-Z_]\w*)(?=\s*\()/ },
      { type: "number", regex: /^\b\d+(?:\.\d+)?\b/ },
    ];
  } else if (kind === "bash") {
    patterns = [
      { type: "comment", regex: /^#.*/ },
      { type: "string", regex: /^(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/ },
      { type: "keyword", regex: /^\b(?:ros2|colcon|sudo|cd|source|export|apt|echo|bash|sh|install|build|run|launch|node|topic|service|action|param|pkg|if|then|else|fi|for|do|done|while|case|esac)\b/ },
      { type: "property", regex: /^--?[a-zA-Z0-9_-]+/ },
      { type: "number", regex: /^\b\d+\b/ },
    ];
  } else if (kind === "xml") {
    patterns = [
      { type: "comment", regex: /^<!--[\s\S]*?-->/ },
      { type: "string", regex: /^(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/ },
      { type: "keyword", regex: /^<\/?[\w:-]+/ },
      { type: "property", regex: /^\b[\w:-]+(?=\s*=)/ },
      { type: "number", regex: /^\b\d+(?:\.\d+)?\b/ },
    ];
  } else if (kind === "yaml") {
    patterns = [
      { type: "comment", regex: /^#.*/ },
      { type: "string", regex: /^(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/ },
      { type: "property", regex: /^[a-zA-Z0-9_-]+(?=\s*:)/ },
      { type: "keyword", regex: /^\b(?:true|false|yes|no|null|on|off)\b/i },
      { type: "number", regex: /^\b\d+(?:\.\d+)?\b/ },
    ];
  }

  while (remaining.length > 0) {
    let matched = false;

    for (const { type, regex } of patterns) {
      const match = remaining.match(regex);
      if (match && match.index === 0) {
        tokens.push({ type, text: match[0] });
        remaining = remaining.substring(match[0].length);
        matched = true;
        break;
      }
    }

    if (!matched) {
      // 일반 문자 하나 전진 (다음 매치 후보까지 묶을 수도 있지만 정확한 원본 보존을 위해)
      const lastToken = tokens[tokens.length - 1];
      if (lastToken && lastToken.type === "plain") {
        lastToken.text += remaining[0];
      } else {
        tokens.push({ type: "plain", text: remaining[0] });
      }
      remaining = remaining.substring(1);
    }
  }

  return tokens;
}

// 색상 매핑
export function getTokenColor(type: SyntaxToken["type"]): string | undefined {
  switch (type) {
    case "keyword":
      return "#C792EA";
    case "string":
      return "#C3E88D";
    case "comment":
      return "#7A8290";
    case "function":
      return "#82AAFF";
    case "number":
      return "#F78C6C";
    case "property":
      return "#FFCB6B";
    default:
      return undefined; // 기본 코드 글자색 #D4D7DD 사용
  }
}
