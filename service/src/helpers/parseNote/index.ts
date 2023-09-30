type NodeType = {
  children?: NodeType[];
  text?: string;
};

function extractTextFromJson(jsonString: string): string {
  const obj: { root: NodeType } = JSON.parse(jsonString);

  let extractedTexts: string[] = [];

  function traverse(node: NodeType): void {
    if (node && node.children) {
      for (let child of node.children) {
        traverse(child);
      }
    }
    if (node && node.text) {
      extractedTexts.push(node.text);
    }
  }

  traverse(obj.root);

  return extractedTexts.join(' '); // Join the texts with a space in between.
}

export default extractTextFromJson;
