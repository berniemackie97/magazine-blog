import { compile } from "@mdx-js/mdx";
import remarkGfm from "remark-gfm";
import { mdxPolicy } from "../../lib/studio/mdx-policy";

self.onmessage = async ({
  data,
}: MessageEvent<{ id: number; action: "lint" | "format"; source: string }>) => {
  try {
    if (data.action === "format") {
      const [prettier, markdown, babel, estree] = await Promise.all([
        import("prettier/standalone"),
        import("prettier/plugins/markdown"),
        import("prettier/plugins/babel"),
        import("prettier/plugins/estree"),
      ]);
      const source = await prettier.format(data.source, {
        parser: "mdx",
        plugins: [markdown, babel, estree],
        tabWidth: 2,
        printWidth: 88,
        proseWrap: "preserve",
      });
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
