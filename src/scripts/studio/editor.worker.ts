import { compile } from "@mdx-js/mdx";
import remarkGfm from "remark-gfm";
import { mdxPolicy } from "../../lib/studio/mdx-policy";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkMdx from "remark-mdx";
import remarkStringify from "remark-stringify";

interface FormatNode {
  children?: FormatNode[];
  attributes?: { value?: string | { type: string; value: string } | null }[];
}

self.onmessage = async ({
  data,
}: MessageEvent<{ id: number; action: "lint" | "format"; source: string }>) => {
  try {
    if (data.action === "format") {
      await compile(data.source, { remarkPlugins: [remarkGfm, mdxPolicy] });
      const [prettier, babel, estree] = await Promise.all([
        import("prettier/standalone"),
        import("prettier/plugins/babel"),
        import("prettier/plugins/estree"),
      ]);
      const processor = unified()
        .use(remarkParse)
        .use(remarkMdx, { printWidth: 88 })
        .use(remarkGfm)
        .use(remarkStringify, {
          bullet: "-",
          fences: true,
          listItemIndent: "one",
        });
      const tree = processor.parse(data.source);
      async function formatProperties(node: FormatNode): Promise<void> {
        for (const attribute of node.attributes ?? []) {
          if (
            typeof attribute.value === "object" &&
            attribute.value?.type === "mdxJsxAttributeValueExpression"
          ) {
            attribute.value.value = (
              await prettier.format(attribute.value.value, {
                parser: "json5",
                plugins: [babel, estree],
                tabWidth: 2,
                printWidth: 80,
              })
            ).trim();
          }
        }
        for (const child of node.children ?? []) await formatProperties(child);
      }
      await formatProperties(tree as FormatNode);
      const source = processor.stringify(tree);
      await compile(source, { remarkPlugins: [remarkGfm, mdxPolicy] });
      self.postMessage({ id: data.id, source });
    } else {
      await compile(data.source, { remarkPlugins: [remarkGfm, mdxPolicy] });
      self.postMessage({ id: data.id });
    }
  } catch (error) {
    const problem = error as {
      message?: string;
      reason?: string;
      line?: number;
      column?: number;
    };
    self.postMessage({
      id: data.id,
      error:
        problem.reason ??
        problem.message ??
        "The document could not be processed.",
      line: problem.line,
      column: problem.column,
    });
  }
};

self.postMessage({ ready: true });
