const fs = require("fs");
const path = require("path");
const root = "F:/PRD_IMS_SEPCUNE/Inventory_Management_Node.js_Production/Mobile";
function w(rel, content) {
  const p = path.join(root, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content);
}
