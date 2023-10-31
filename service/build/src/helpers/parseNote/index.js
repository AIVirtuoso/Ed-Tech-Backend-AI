function extractTextFromJson(jsonString) {
    const obj = JSON.parse(jsonString);
    let extractedTexts = [];
    function traverse(node) {
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
