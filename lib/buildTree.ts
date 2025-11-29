// lib/buildTree.ts
export interface AXNodeRaw {
  nodeId: string;
  role?: { value: string | number };
  name?: { value: string };
  ignored?: boolean;
  properties?: any[];
  parentId?: string;
  childIds?: string[];
}

export interface AXNode extends AXNodeRaw {
  children: AXNode[];
}

export function buildTree(nodes: AXNodeRaw[]): AXNode {
  const map = new Map<string, AXNode>();
  nodes.forEach((n) => map.set(n.nodeId, { ...n, children: [] }));
  let root: AXNode | null = null;
  nodes.forEach((n) => {
    if (n.parentId && map.has(n.parentId)) {
      map.get(n.parentId)!.children.push(map.get(n.nodeId)!);
    } else {
      if (!root) root = map.get(n.nodeId)!;
    }
  });
  if (!root) throw new Error("No root accessibility node found.");
  return root;
}
