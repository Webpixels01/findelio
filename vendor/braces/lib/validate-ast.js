'use strict';

// Validate iteratively before entering the upstream recursive AST walkers.
// Parent/prev links are deliberately excluded from traversal.
module.exports = ast => {
  const queue = [[ast, 0]];
  const seen = new Set();
  while (queue.length) {
    const [node, depth] = queue.pop();
    if (!node || typeof node !== 'object') continue;
    if (depth >= 128 || seen.has(node) || seen.size >= 65536) {
      throw new SyntaxError('Brace AST exceeds the security limit');
    }
    seen.add(node);
    if (Array.isArray(node.nodes)) {
      if (node.nodes.length + queue.length > 65536) {
        throw new SyntaxError('Brace AST exceeds the security limit');
      }
      for (const child of node.nodes) queue.push([child, depth + 1]);
    }
  }
};
