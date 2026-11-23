import { basicSetup } from "codemirror";
import { EditorState, type Extension } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { indentWithTab, undo, redo } from "@codemirror/commands";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { javascript } from "@codemirror/lang-javascript";
import { languages } from "@codemirror/language-data";
import { indentUnit } from "@codemirror/language";
import {
  autocompletion,
  type CompletionContext,
  snippetCompletion,
} from "@codemirror/autocomplete";
import { openSearchPanel } from "@codemirror/search";
import { setDiagnostics } from "@codemirror/lint";
import { componentSchemas } from "../../lib/content/component-schema";
import { blocks } from "./fields";

function complete(context: CompletionContext) {
  const tag = context.matchBefore(/<\/?[A-Z][\w]*$/);
  if (tag)
    return {
      from: tag.from + (tag.text.startsWith("</") ? 2 : 1),
      options: blocks.map((block) => ({
        label: block.name,
        type: "class",
        detail: block.label,
      })),
    };
  const before = context.state.sliceDoc(0, context.pos);
  const opening = /<([A-Z]\w*)\s+([^<>]*)$/.exec(before);
  if (opening && opening[1]! in componentSchemas) {
    const word = context.matchBefore(/\w*$/)!;
    const schema =
      componentSchemas[opening[1] as keyof typeof componentSchemas];
    return {
      from: word.from,
      options: Object.keys(schema.shape)
        .filter((key) => !new RegExp(`\\b${key}\\s*=`).test(opening[2]!))
        .map((key) =>
          snippetCompletion(
            ["checklist", "open"].includes(key)
              ? `${key}={\u0024{true}}`
              : ["items", "tags", "altSources"].includes(key)
                ? `${key}={[\u0024{}]}`
                : ["width", "height"].includes(key)
                  ? `${key}={\u0024{800}}`
                  : `${key}="\u0024{}"`,
            { label: key, type: "property" },
          ),
        ),
    };
  }
  if (!context.explicit) return null;
  const word = context.matchBefore(/\w*$/)!;
  return {
    from: word.from,
    options: blocks.map((block) =>
      snippetCompletion(
        `<${block.name}${block.fields.map((field) => ` ${field.key}="\u0024{${field.label}}"`).join("")}${block.children ? `>\n\u0024{${block.children}}\n</${block.name}>` : " />"}`,
        { label: block.name, type: "class", detail: block.label },
      ),
    ),
  };
}

interface Result {
  id: number;
  source?: string;
  error?: string;
  line?: number;
  column?: number;
}

export class SourceEditor {
  private readonly view: EditorView;
  private readonly worker = new Worker(
    new URL("./editor.worker.ts", import.meta.url),
    { type: "module" },
  );
  private readonly pending = new Map<number, (result: Result) => void>();
  private serial = 0;
  private timer?: ReturnType<typeof setTimeout>;
  private documentVersion = 0;
  private readonly extensions: Extension[];

  constructor(
    parent: HTMLElement,
    private readonly onChange: (source: string) => void,
    private readonly report: (message: string, error?: boolean) => void,
  ) {
    this.extensions = [
      basicSetup,
      markdown({
        base: markdownLanguage,
        htmlTagLanguage: javascript({ jsx: true }),
        codeLanguages: languages,
        completeHTMLTags: false,
      }),
      indentUnit.of("  "),
      EditorState.tabSize.of(2),
      EditorView.lineWrapping,
      autocompletion({ override: [complete] }),
      keymap.of([
        {
          key: "Mod-Shift-f",
          run: () => {
            void this.format();
            return true;
          },
        },
        indentWithTab,
      ]),
      EditorView.contentAttributes.of({
        "aria-label": "Article body in Markdown and MDX",
        spellcheck: "false",
        "aria-describedby": "source-help",
      }),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          this.documentVersion++;
          this.onChange(this.value);
          this.scheduleLint();
        }
      }),
    ];
    this.view = new EditorView({
      parent,
      state: EditorState.create({ extensions: this.extensions }),
    });
    this.worker.onmessage = ({ data }: MessageEvent<Result>) => {
      this.pending.get(data.id)?.(data);
      this.pending.delete(data.id);
    };
    this.worker.onerror = () => {
      for (const [id, resolve] of this.pending)
        resolve({
          id,
          error:
            "Editor analysis failed. Reload Studio to restart it. Your writing is preserved.",
        });
      this.pending.clear();
      this.report("Editor analysis failed. Your writing is preserved.", true);
    };
  }
  get value(): string {
    return this.view.state.doc.toString();
  }
  load(source: string): void {
    this.documentVersion++;
    this.view.setState(
      EditorState.create({ doc: source, extensions: this.extensions }),
    );
    this.scheduleLint();
  }
  insert(text: string, wrap?: string): void {
    const { from, to } = this.view.state.selection.main;
    const selected = this.view.state.sliceDoc(from, to);
    const insert =
      wrap === undefined ? text : text + (selected || "text") + wrap;
    this.view.dispatch({
      changes: { from, to, insert },
      selection: { anchor: from + insert.length },
      userEvent: "input",
    });
    this.view.focus();
  }
  undo(): void {
    undo(this.view);
    this.view.focus();
  }
  redo(): void {
    redo(this.view);
    this.view.focus();
  }
  search(): void {
    openSearchPanel(this.view);
  }
  private request(action: "lint" | "format", source: string): Promise<Result> {
    const id = ++this.serial;
    return new Promise((resolve) => {
      this.pending.set(id, resolve);
      this.worker.postMessage({ id, action, source });
    });
  }
  private scheduleLint(): void {
    clearTimeout(this.timer);
    const version = this.documentVersion;
    document.getElementById("editor-diagnostic")!.textContent = "Checking MDX…";
    this.timer = setTimeout(async () => {
      const result = await this.request("lint", this.value);
      if (version !== this.documentVersion) return;
      const status = document.getElementById("editor-diagnostic")!;
      status.textContent = result.error ? result.error : "MDX checked";
      status.classList.toggle("error", !!result.error);
      const line = this.view.state.doc.line(
        Math.max(1, Math.min(result.line ?? 1, this.view.state.doc.lines)),
      );
      const from = Math.min(
        line.to,
        line.from + Math.max(0, (result.column ?? 1) - 1),
      );
      this.view.dispatch(
        setDiagnostics(
          this.view.state,
          result.error
            ? [
                {
                  from,
                  to: Math.min(this.view.state.doc.length, from + 1),
                  severity: "error",
                  message: result.error,
                },
              ]
            : [],
        ),
      );
    }, 450);
  }
  async format(): Promise<void> {
    const version = this.documentVersion;
    const result = await this.request("format", this.value);
    if (version !== this.documentVersion) {
      this.report("Writing changed while formatting. Run Format again.");
      return;
    }
    if (result.error) {
      this.report(result.error, true);
      return;
    }
    if (result.source !== undefined && result.source !== this.value) {
      const anchor = Math.min(
        this.view.state.selection.main.head,
        result.source.length,
      );
      this.view.dispatch({
        changes: {
          from: 0,
          to: this.view.state.doc.length,
          insert: result.source,
        },
        selection: { anchor },
        userEvent: "input.format",
      });
    }
    this.report("Document formatted. Undo restores the previous formatting.");
    this.view.focus();
  }
}
