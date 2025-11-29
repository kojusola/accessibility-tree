"use client";

import { useRef } from "react";
import ZoomableAXTree, { VizHandle } from "@/components/ZoomableAXTree";

// Import your AX tree data
import axTreeData from "@/lib/exampleAXTree.json";

/**
 * Build hierarchy from flat CDP AX tree
 */
function buildTreeFromFlat(nodes: any[]): any {
  const map = new Map<string, any>();
  nodes.forEach((n) => map.set(n.nodeId, { ...n, children: [] }));

  let root: any = null;
  nodes.forEach((n) => {
    if (n.parentId) {
      const parent = map.get(n.parentId);
      if (parent) parent.children.push(map.get(n.nodeId));
    } else {
      root = map.get(n.nodeId);
    }
  });

  return root;
}

/**
 * Extract focusable links and buttons
 */
function getFocusableLinksAndButtons(node: any): any[] {
  const focusable: any[] = [];

  function dfs(n: any) {
    const isIgnored = !!n.ignored;
    const roleStr = n.role?.value?.toLowerCase();
    const focusableProp = n.properties?.find(
      (p: any) => p.name === "focusable" && p.value?.value === true
    );

    if (
      !isIgnored &&
      focusableProp &&
      (roleStr === "link" || roleStr === "button")
    ) {
      focusable.push(n);
    }

    if (n.children) n.children.forEach(dfs);
  }

  dfs(node);
  return focusable;
}

export default function KeyboardFlowPage() {
  const vizRef = useRef<VizHandle>(null);

  const rootNode = buildTreeFromFlat(axTreeData);
  const focusableNodes = getFocusableLinksAndButtons(rootNode);

  const playKeyboardFlow = async () => {
    if (!vizRef.current) return;

    for (const node of focusableNodes) {
      // Pan and zoom to node
      vizRef.current.focusNode(node.nodeId);

      // Highlight node
      const highlightEvent = new CustomEvent("highlight-node", {
        detail: { nodeId: node.nodeId },
      });
      window.dispatchEvent(highlightEvent);

      // Wait 700ms before next
      await new Promise((res) => setTimeout(res, 700));
    }
  };

  return (
    <div className='p-6 space-y-4'>
      <h1 className='text-2xl font-bold'>Keyboard Flow: Links & Buttons</h1>
      <button
        className='px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700'
        onClick={playKeyboardFlow}
      >
        Play Keyboard Flow
      </button>

      <ZoomableAXTree
        ref={vizRef}
        data={rootNode}
        width={1200}
        height={800}
        filterRoles={new Set(["link", "button"])} // optional, enforce filtering
        highlightIds={new Set()}
        onSelectNode={(node) => console.log("Selected node:", node)}
      />
    </div>
  );
}
