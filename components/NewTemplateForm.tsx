'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type CreateTemplateRequest = {
  ownerRef: string;
  title: string;
  summary: string;
  content: string;
  type: 'CODE' | 'IDEA' | 'STORY' | 'OTHER';
  tags: string[];
};

type ErrorResponse = { error?: string };

type Props = {
  ownerRef: string;
};

type DetectedLanguage = 'Luau' | 'Python' | 'Unknown';

type TokenType = 'plain' | 'keyword' | 'builtin' | 'string' | 'comment' | 'number' | 'function' | 'operator';

type Token = {
  text: string;
  type: TokenType;
};

type DraftPayload = Partial<Record<'title' | 'summary' | 'content' | 'type' | 'tags', string>>;

const DRAFT_STORAGE_KEYS = ['database_templates_web_contribute_draft_v2'] as const;

const ALLOWED_TYPES = new Set<CreateTemplateRequest['type']>(['CODE', 'IDEA', 'STORY', 'OTHER']);
const TAG_PATTERN = /^[a-z0-9][a-z0-9_-]{0,29}$/i;
const TAG_SYNONYM: Record<string, string> = {
  py: 'python',
  rbx: 'roblox',
  lua: 'luau',
  js: 'javascript',
  ts: 'typescript'
};

const LUAU_KEYWORDS = new Set([
  'local', 'function', 'end', 'then', 'elseif', 'repeat', 'until', 'nil', 'not', 'and', 'or', 'for', 'while', 'do',
  'if', 'return', 'break', 'continue', 'in'
]);
const LUAU_BUILTINS = new Set([
  'pairs', 'ipairs', 'next', 'typeof', 'setmetatable', 'getmetatable', 'pcall', 'xpcall', 'require', 'game', 'workspace', 'script', 'task', 'math', 'string', 'table', 'Instance', 'Vector3', 'CFrame', 'Color3', 'Enum'
]);
const PYTHON_KEYWORDS = new Set([
  'def', 'import', 'from', 'class', 'self', 'elif', 'None', 'True', 'False', 'async', 'await', 'except', 'lambda',
  'with', 'yield', 'if', 'else', 'for', 'while', 'return', 'pass', 'break', 'continue', 'try', 'finally', 'as', 'in', 'is', 'not', 'and', 'or'
]);
const PYTHON_BUILTINS = new Set([
  'print', 'len', 'range', 'enumerate', 'map', 'filter', 'sum', 'min', 'max', 'open', 'str', 'int', 'float', 'dict', 'list', 'set', 'tuple', '__name__'
]);

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function normalizeTag(tag: string): string {
  const base = tag.toLowerCase();
  return TAG_SYNONYM[base] ?? base;
}

function parseTags(raw: string): string[] {
  return raw
    .split(/[\s,]+/)
    .map((tag) => tag.trim())
    .filter(Boolean)
    .map((tag) => tag.replace(/^#+/, '').trim())
    .filter(Boolean)
    .map((tag) => normalizeTag(tag));
}

function buildCreateTemplateRequest(formData: FormData, ownerRef: string): CreateTemplateRequest {
  const rawType = String(formData.get('type') ?? 'OTHER').trim().toUpperCase();

  return {
    ownerRef: ownerRef.trim(),
    title: String(formData.get('title') ?? '').trim(),
    summary: String(formData.get('summary') ?? '').trim(),
    content: String(formData.get('content') ?? '').trim(),
    type: ALLOWED_TYPES.has(rawType as CreateTemplateRequest['type'])
      ? (rawType as CreateTemplateRequest['type'])
      : 'OTHER',
    tags: parseTags(String(formData.get('tags') ?? ''))
  };
}

function validateRequestBody(body: CreateTemplateRequest): string | null {
  const errors: string[] = [];

  if (!body.ownerRef) errors.push('Invalid profile. Please register again.');
  if (body.title.length < 3 || body.title.length > 120) errors.push('Title must be 3-120 characters.');
  if (body.summary.length < 10 || body.summary.length > 300) errors.push('Summary must be 10-300 characters.');
  if (body.content.length < 10) errors.push('Template content must be at least 10 characters.');
  if (body.tags.length < 1 || body.tags.length > 12) errors.push('Tags must contain 1-12 items.');
  if (body.tags.some((tag) => !TAG_PATTERN.test(tag))) errors.push('Invalid tag format. Use letters, numbers, hyphen, or underscore only.');

  return errors.length > 0 ? errors.join(' ') : null;
}

function detectLanguage(content: string): DetectedLanguage {
  const luauHits = [
    /--.*$/gm,
    /\b(local|function|end|then|elseif|repeat|until|game|workspace|script|task|ipairs|pairs|Enum|Vector3|CFrame)\b/g,
    /\b[A-Z][A-Za-z0-9_]*\.new\(/g
  ].reduce((acc, pattern) => acc + (content.match(pattern)?.length ?? 0), 0);

  const pythonHits = [
    /#.*$/gm,
    /\b(def|import|from|class|elif|except|lambda|with|yield|async|await|self|None|True|False)\b/g,
    /:\s*$/gm,
    /\bself\./g
  ].reduce((acc, pattern) => acc + (content.match(pattern)?.length ?? 0), 0);

  if (luauHits === 0 && pythonHits === 0) return 'Unknown';
  if (luauHits === pythonHits) return 'Unknown';
  return luauHits > pythonHits ? 'Luau' : 'Python';
}

function lintHints(content: string, language: DetectedLanguage): string[] {
  const hints: string[] = [];
  const lines = content.split('\n');
  const tooLong = lines.some((line) => line.length > 110);
  const tabIndent = lines.some((line) => /^\t+/.test(line));
  const spaceIndent = lines.some((line) => /^ {2,}/.test(line));

  if (tooLong) hints.push('Some lines are longer than 110 characters.');
  if (tabIndent && spaceIndent) hints.push('Indentation mixes tabs and spaces.');

  if (language === 'Python') {
    const openColon = lines.some((line) => /\b(if|for|while|def|class|elif|else|try|except|with)\b.*[^:]$/.test(line.trim()));
    if (openColon) hints.push('A Python statement may be missing a trailing colon (:).');
  }

  if (language === 'Luau') {
    const fnCount = (content.match(/\bfunction\b/g) ?? []).length;
    const endCount = (content.match(/\bend\b/g) ?? []).length;
    if (fnCount > endCount) hints.push('A Luau function may be missing a closing `end`.');
  }

  return hints.slice(0, 3);
}

function lexLine(line: string, language: DetectedLanguage): Token[] {
  if (!line) return [{ text: ' ', type: 'plain' }];

  const keywords = language === 'Luau' ? LUAU_KEYWORDS : language === 'Python' ? PYTHON_KEYWORDS : new Set<string>();
  const builtins = language === 'Luau' ? LUAU_BUILTINS : language === 'Python' ? PYTHON_BUILTINS : new Set<string>();

  const tokens: Token[] = [];
  let i = 0;

  while (i < line.length) {
    const rest = line.slice(i);
    const commentStart = language === 'Luau' ? '--' : language === 'Python' ? '#' : '';

    if (commentStart && rest.startsWith(commentStart)) {
      tokens.push({ text: rest, type: 'comment' });
      break;
    }

    const stringMatch = rest.match(/^(["'])(?:\\.|(?!\1).)*\1/);
    if (stringMatch) {
      tokens.push({ text: stringMatch[0], type: 'string' });
      i += stringMatch[0].length;
      continue;
    }

    const numberMatch = rest.match(/^\b\d+(?:\.\d+)?\b/);
    if (numberMatch) {
      tokens.push({ text: numberMatch[0], type: 'number' });
      i += numberMatch[0].length;
      continue;
    }

    const functionCallMatch = rest.match(/^\b([A-Za-z_][A-Za-z0-9_]*)\s*(?=\()/);
    if (functionCallMatch) {
      tokens.push({ text: functionCallMatch[1], type: 'function' });
      i += functionCallMatch[1].length;
      continue;
    }

    const wordMatch = rest.match(/^\b[A-Za-z_][A-Za-z0-9_]*\b/);
    if (wordMatch) {
      const word = wordMatch[0];
      if (keywords.has(word)) tokens.push({ text: word, type: 'keyword' });
      else if (builtins.has(word)) tokens.push({ text: word, type: 'builtin' });
      else tokens.push({ text: word, type: 'plain' });
      i += word.length;
      continue;
    }

    const opMatch = rest.match(/^(==|~=|!=|<=|>=|=>|:=|\+|-|\*|\/|=|<|>|\.|:|\(|\)|\[|\]|\{|\}|,)/);
    if (opMatch) {
      tokens.push({ text: opMatch[0], type: 'operator' });
      i += opMatch[0].length;
      continue;
    }

    tokens.push({ text: line[i], type: 'plain' });
    i += 1;
  }

  return tokens;
}

function highlightToHtml(content: string, language: DetectedLanguage): string {
  const lines = content.split('\n').slice(0, 220);
  return lines
    .map((line) => lexLine(line, language).map((t) => `<span class="code-${t.type}">${escapeHtml(t.text)}</span>`).join(''))
    .join('\n');
}

function readDraftFromStorage(): DraftPayload | null {
  for (const key of DRAFT_STORAGE_KEYS) {
    const raw = localStorage.getItem(key);
    if (!raw) continue;

    try {
      return JSON.parse(raw) as DraftPayload;
    } catch (error) {
      console.error(`Failed to parse draft from localStorage (${key}):`, error);
    }
  }

  return null;
}

function persistDraftToStorage(draft: DraftPayload) {
  localStorage.setItem(DRAFT_STORAGE_KEYS[0], JSON.stringify(draft));
}

function clearDraftFromStorage() {
  for (const key of DRAFT_STORAGE_KEYS) {
    localStorage.removeItem(key);
  }
}

async function parseErrorResponse(response: Response): Promise<string> {
  const contentType = response.headers.get('content-type') ?? '';

  if (contentType.includes('application/json')) {
    const textBody = await response.text();

    if (textBody.trim().length > 0) {
      try {
        const parsed = JSON.parse(textBody) as ErrorResponse;
        if (typeof parsed.error === 'string' && parsed.error.trim().length > 0) {
          return parsed.error.trim();
        }
      } catch (error) {
        console.error('Failed to parse API error response JSON:', error, textBody);
      }
    }
  }

  return `Request failed (${response.status} ${response.statusText}).`;
}

export function NewTemplateForm({ ownerRef }: Props) {
  const [status, setStatus] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedType, setSelectedType] = useState<CreateTemplateRequest['type']>('CODE');
  const [contentDraft, setContentDraft] = useState('');
  const [titleDraft, setTitleDraft] = useState('');
  const [summaryDraft, setSummaryDraft] = useState('');
  const [tagDraft, setTagDraft] = useState('');
  const editorRef = useRef<HTMLTextAreaElement | null>(null);
  const highlightRef = useRef<HTMLPreElement | null>(null);

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const prefillTitle = params.get('title') ?? '';
      const prefillSummary = params.get('summary') ?? '';
      const prefillContent = params.get('content') ?? '';
      const prefillType = params.get('type')?.toUpperCase() as CreateTemplateRequest['type'] | undefined;
      const prefillTags = params.get('tags') ?? '';

      const storedDraft = readDraftFromStorage();
      if (storedDraft) {
        if (typeof storedDraft.title === 'string') setTitleDraft(storedDraft.title);
        if (typeof storedDraft.summary === 'string') setSummaryDraft(storedDraft.summary);
        if (typeof storedDraft.content === 'string') setContentDraft(storedDraft.content);
        if (typeof storedDraft.type === 'string' && ALLOWED_TYPES.has(storedDraft.type as CreateTemplateRequest['type'])) {
          setSelectedType(storedDraft.type as CreateTemplateRequest['type']);
        }
        if (typeof storedDraft.tags === 'string') setTagDraft(storedDraft.tags);
      }

      if (prefillTitle) setTitleDraft(prefillTitle);
      if (prefillSummary) setSummaryDraft(prefillSummary);
      if (prefillContent) setContentDraft(prefillContent);
      if (prefillType && ALLOWED_TYPES.has(prefillType)) setSelectedType(prefillType);
      if (prefillTags) setTagDraft(prefillTags);
    } catch (error) {
      console.error('Failed to initialize contribute draft:', error);
    }
  }, []);

  useEffect(() => {
    try {
      persistDraftToStorage({
        title: titleDraft,
        summary: summaryDraft,
        content: contentDraft,
        type: selectedType,
        tags: tagDraft
      });
    } catch (error) {
      console.error('Failed to persist contribute draft:', error);
    }
  }, [titleDraft, summaryDraft, contentDraft, selectedType, tagDraft]);

  const detectedLanguage = useMemo(() => (selectedType === 'CODE' ? detectLanguage(contentDraft) : 'Unknown'), [contentDraft, selectedType]);
  const highlightedHtml = useMemo(() => (selectedType === 'CODE' ? highlightToHtml(contentDraft, detectedLanguage) : ''), [contentDraft, detectedLanguage, selectedType]);
  const codeHints = useMemo(() => (selectedType === 'CODE' ? lintHints(contentDraft, detectedLanguage) : []), [contentDraft, detectedLanguage, selectedType]);
  const normalizedTagsPreview = useMemo(() => parseTags(tagDraft).join(' #'), [tagDraft]);

  function syncScroll() {
    if (!editorRef.current || !highlightRef.current) return;
    highlightRef.current.scrollTop = editorRef.current.scrollTop;
    highlightRef.current.scrollLeft = editorRef.current.scrollLeft;
  }

  async function submit(formData: FormData) {
    if (isSubmitting) return;

    setStatus('');
    setIsSubmitting(true);

    try {
      const requestBody = buildCreateTemplateRequest(formData, ownerRef);
      const validationError = validateRequestBody(requestBody);
      if (validationError) {
        setStatus(validationError);
        return;
      }

      const response = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const serverMessage = await parseErrorResponse(response);
        setStatus(serverMessage);
        return;
      }

      clearDraftFromStorage();
      setStatus('Template published successfully.');
    } catch (error) {
      console.error('Submit template failed:', error);
      setStatus(error instanceof Error ? error.message : 'An unexpected error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="card form-compact">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h3>Contribute New Template</h3>
        {selectedType === 'CODE' && <small className="lang-indicator">Detected: {detectedLanguage}</small>}
      </div>
      <form action={submit} className="form-grid">
        <input
          name="title"
          placeholder="Template Title"
          required
          minLength={3}
          maxLength={120}
          disabled={isSubmitting}
          className="col-6"
          value={titleDraft}
          onChange={(event) => setTitleDraft(event.target.value)}
        />
        <select
          name="type"
          value={selectedType}
          disabled={isSubmitting}
          onChange={(event) => setSelectedType((event.target.value as CreateTemplateRequest['type']) || 'OTHER')}
          className="col-6"
        >
          <option value="CODE">CODE</option>
          <option value="IDEA">IDEA</option>
          <option value="STORY">STORY</option>
          <option value="OTHER">OTHER</option>
        </select>

        <textarea
          name="summary"
          placeholder="Summary"
          required
          minLength={10}
          maxLength={300}
          disabled={isSubmitting}
          rows={2}
          className="col-12"
          value={summaryDraft}
          onChange={(event) => setSummaryDraft(event.target.value)}
        />

        {selectedType === 'CODE' ? (
          <div className="code-editor col-12">
            <pre ref={highlightRef} className="code-layer" aria-hidden="true" dangerouslySetInnerHTML={{ __html: highlightedHtml || ' ' }} />
            <textarea
              ref={editorRef}
              name="content"
              placeholder="Template Content (code)"
              required
              minLength={10}
              rows={8}
              disabled={isSubmitting}
              value={contentDraft}
              onChange={(event) => setContentDraft(event.target.value)}
              onScroll={syncScroll}
              className="code-input"
              spellCheck={false}
            />
          </div>
        ) : (
          <textarea
            name="content"
            placeholder="Template Content"
            required
            minLength={10}
            rows={6}
            disabled={isSubmitting}
            value={contentDraft}
            onChange={(event) => setContentDraft(event.target.value)}
            className="col-12"
          />
        )}

        {codeHints.length > 0 && (
          <ul className="lint-hints col-12">
            {codeHints.map((hint) => (
              <li key={hint}>{hint}</li>
            ))}
          </ul>
        )}

        <label className="tags-field col-12">
          <span className="hash-prefix">#</span>
          <input
            name="tags"
            placeholder="tag1 tag2 tag3"
            required
            disabled={isSubmitting}
            className="tags-input"
            value={tagDraft}
            onChange={(event) => setTagDraft(event.target.value)}
          />
        </label>

        {normalizedTagsPreview && <p className="muted col-12">Normalized tags: #{normalizedTagsPreview}</p>}

        <button type="submit" disabled={isSubmitting} className="col-12 submit-wide">
          {isSubmitting ? 'Publishing...' : 'Publish Template'}
        </button>
      </form>
      {status && <p className="muted">{status}</p>}
    </section>
  );
}
