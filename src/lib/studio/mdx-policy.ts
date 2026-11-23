import { componentSchemas } from "../content/component-schema";
import { safeUrl } from "../content/links";
export { safeUrl } from "../content/links";
interface Node {
  type: string;
  position?: { start: { line: number; column: number } };
  name?: string;
  value?: unknown;
  url?: string;
  children?: Node[];
  attributes?: Node[];
  data?: { estree?: Node };
  body?: Node[];
  expression?: Node;
  elements?: (Node | null)[];
  properties?: Node[];
  argument?: Node;
  key?: Node;
  computed?: boolean;
  method?: boolean;
  kind?: string;
  operator?: string;
}
const components = new Set(Object.keys(componentSchemas));
const html = new Set([
  "a",
  "p",
  "br",
  "hr",
  "strong",
  "em",
  "del",
  "s",
  "code",
  "pre",
  "kbd",
  "samp",
  "mark",
  "small",
  "sub",
  "sup",
  "abbr",
  "blockquote",
  "ul",
  "ol",
  "li",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
  "details",
  "summary",
  "figure",
  "figcaption",
  "img",
  "div",
  "span",
]);

function literal(node: Node): boolean {
  switch (node.type) {
    case "Program":
      return (node.body ?? []).every(literal);
    case "ExpressionStatement":
      return !!node.expression && literal(node.expression);
    case "Literal":
      return (
        node.value === null ||
        ["string", "number", "boolean"].includes(typeof node.value)
      );
    case "ArrayExpression":
      return (node.elements ?? []).every((n) => n !== null && literal(n));
    case "ObjectExpression":
      return (node.properties ?? []).every(literal);
    case "Property": {
      const key = String(node.key?.name ?? node.key?.value ?? "");
      if (["__proto__", "constructor", "prototype"].includes(key)) return false;
      if (
        ["href", "src", "poster"].includes(key) &&
        (typeof (node.value as Node)?.value !== "string" ||
          !safeUrl((node.value as Node).value as string))
      )
        return false;
      return (
        !node.computed &&
        !node.method &&
        node.kind === "init" &&
        !!node.value &&
        literal(node.value as Node)
      );
    }
    case "UnaryExpression":
      return (
        ["-", "+"].includes(node.operator ?? "") &&
        node.argument?.type === "Literal" &&
        typeof node.argument.value === "number"
      );
    default:
      return false;
  }
}
function literalValue(node: Node): unknown {
  if (node.type === "Program")
    return node.body?.[0] ? literalValue(node.body[0]) : undefined;
  if (node.type === "ExpressionStatement")
    return literalValue(node.expression!);
  if (node.type === "Literal") return node.value;
  if (node.type === "ArrayExpression")
    return node.elements!.map((n) => literalValue(n!));
  if (node.type === "ObjectExpression")
    return Object.fromEntries(
      node.properties!.map((n) => [
        String(n.key?.name ?? n.key?.value),
        literalValue(n.value as Node),
      ]),
    );
  if (node.type === "UnaryExpression")
    return Number(node.argument!.value) * (node.operator === "-" ? -1 : 1);
  throw new Error("Unsupported expression.");
}

function fail(node: Node, message: string): never {
  throw Object.assign(new Error(message), node.position?.start);
}
export function mdxPolicy() {
  return (tree: Node): void => {
    function visit(node: Node): void {
      if (node.type === "mdxjsEsm")
        fail(
          node,
          "Use the site's registered components; imports and exports are not supported in articles.",
        );
      if (
        node.type === "mdxFlowExpression" ||
        node.type === "mdxTextExpression" ||
        node.type === "mdxJsxAttributeValueExpression"
      ) {
        if (!node.data?.estree || !literal(node.data.estree))
          fail(
            node,
            "MDX expressions must contain literal values, arrays, or objects.",
          );
      }
      if (
        node.type === "mdxJsxFlowElement" ||
        node.type === "mdxJsxTextElement"
      ) {
        if (node.name && !components.has(node.name) && !html.has(node.name))
          fail(node, `Unsupported component: ${node.name}.`);
        for (const attr of node.attributes ?? []) {
          if (
            attr.type !== "mdxJsxAttribute" ||
            !attr.name ||
            /^on/i.test(attr.name) ||
            [
              "set:html",
              "set:text",
              "style",
              "srcdoc",
              "dangerouslySetInnerHTML",
            ].includes(attr.name) ||
            attr.name.includes(":")
          )
            fail(node, "Executable MDX attributes are not supported.");
          if (
            ["href", "src", "poster", "action"].includes(attr.name) &&
            (typeof attr.value !== "string" || !safeUrl(attr.value))
          )
            fail(node, "Use a safe, literal URL.");
          if (attr.value && typeof attr.value === "object")
            visit(attr.value as Node);
        }
        if (node.name && components.has(node.name)) {
          const props = Object.fromEntries(
            (node.attributes ?? []).map((attr) => [
              attr.name!,
              attr.value === null
                ? true
                : typeof attr.value === "object"
                  ? literalValue((attr.value as Node).data!.estree!)
                  : attr.value,
            ]),
          );
          const result =
            componentSchemas[
              node.name as keyof typeof componentSchemas
            ].safeParse(props);
          if (!result.success)
            fail(
              node,
              `${node.name}: ${result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
            );
        }
      }
      if (node.url && !safeUrl(node.url))
        fail(node, "Unsupported link or image URL.");
      for (const child of node.children ?? []) visit(child);
    }
    visit(tree);
  };
}
