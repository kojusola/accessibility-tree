// app/visualizer/page.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { buildTree, AXNode, AXNodeRaw } from "@/lib/buildTree";

const ZoomableAXTree = dynamic(() => import("@/components/ZoomableAXTree"), {
  ssr: false,
});

export default function VisualizerPage() {
  const [raw, setRaw] = useState<AXNodeRaw[] | null>(null);
  const [tree, setTree] = useState<AXNode | null>(null);
  const [query, setQuery] = useState("");
  const [selectedNode, setSelectedNode] = useState<AXNode | null>(null);
  const [roleFilters, setRoleFilters] = useState<Record<string, boolean>>({});
  const vizRef = useRef<any>(null);
  const [highlightIds, setHighlightIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    async function load() {
      const res = await fetch("/axTree.json");
      const json: AXNodeRaw[] = await res.json();
      setRaw(json);
      setTree(buildTree(json));
      // build a role filter map from data
      const roles = Array.from(
        new Set(
          json
            .map((n) => String(n.role?.value || "").toLowerCase())
            .filter(Boolean)
        )
      );
      const initial: Record<string, boolean> = {};
      roles.forEach((r) => (initial[r] = true));
      setRoleFilters(initial);
    }
    load();
  }, []);

  // Hook up minimap click events
  useEffect(() => {
    const handler = (e: any) => {
      const id = e.detail?.nodeId;
      if (id && vizRef.current?.focusNode) vizRef.current.focusNode(id);
    };
    window.addEventListener("minimap-focus", handler as EventListener);
    return () =>
      window.removeEventListener("minimap-focus", handler as EventListener);
  }, []);

  const activeRoleSet = useMemo(() => {
    const s = new Set<string>();
    Object.entries(roleFilters).forEach(([k, v]) => v && k && s.add(k));
    return s;
  }, [roleFilters]);

  // search logic: find nodes whose role/name/nodeId contains query (case-insensitive)
  useEffect(() => {
    if (!raw || !query) {
      setHighlightIds(new Set());
      return;
    }
    const q = query.trim().toLowerCase();
    if (!q) {
      setHighlightIds(new Set());
      return;
    }
    const ids = new Set<string>();
    raw.forEach((n) => {
      const role = String(n.role?.value || "").toLowerCase();
      const name = String(n.name?.value || "").toLowerCase();
      const nid = String(n.nodeId || "");
      if (role.includes(q) || name.includes(q) || nid.includes(q))
        ids.add(n.nodeId);
    });
    setHighlightIds(ids);
    // if there is at least one match, focus on the first after a short delay
    if (ids.size && vizRef.current?.focusNode) {
      const first = Array.from(ids)[0];
      setTimeout(() => vizRef.current.focusNode(first), 300);
    }
  }, [query, raw]);

  const onToggleRole = (role: string) => {
    setRoleFilters((prev) => ({ ...prev, [role]: !prev[role] }));
  };

  if (!tree) return <div className='p-8'>Loading accessibility tree…</div>;

  return (
    <div style={{ display: "flex", height: "100vh", gap: 12 }}>
      {/* Left controls */}
      <div
        style={{
          width: 320,
          padding: 12,
          borderRight: "1px solid #e6e6e6",
          overflow: "auto",
        }}
      >
        <h2 style={{ marginBottom: 8 }}>Controls</h2>

        <div style={{ marginBottom: 12 }}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder='Search role / name / id'
            style={{
              width: "100%",
              padding: 8,
              borderRadius: 8,
              border: "1px solid #ddd",
            }}
          />
        </div>

        <div style={{ marginBottom: 12 }}>
          <button
            onClick={() => vizRef.current?.fitToScreen?.()}
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              background: "#111827",
              color: "#fff",
              border: "none",
            }}
          >
            Fit to screen
          </button>
        </div>

        <div style={{ marginBottom: 12 }}>
          <strong>Role filters</strong>
          <div style={{ marginTop: 8 }}>
            {Object.keys(roleFilters).length === 0 && (
              <div style={{ color: "#666" }}>No roles</div>
            )}
            {Object.entries(roleFilters).map(([role, enabled]) => (
              <label
                key={role}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 6,
                }}
              >
                <input
                  type='checkbox'
                  checked={enabled}
                  onChange={() => onToggleRole(role)}
                />
                <span style={{ textTransform: "capitalize" }}>
                  {role || "(empty)"}
                </span>
              </label>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <strong>Color legend</strong>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 6,
              marginTop: 8,
            }}
          >
            {[
              "heading",
              "link",
              "button",
              "iframe",
              "textbox",
              "banner",
              "generic",
            ].map((r) => (
              <div
                key={r}
                style={{ display: "flex", gap: 8, alignItems: "center" }}
              >
                <div
                  style={{
                    width: 14,
                    height: 14,
                    background: ((): string => {
                      if (r === "heading") return "#4F46E5";
                      if (r === "button") return "#059669";
                      if (r === "link") return "#2563EB";
                      if (r === "iframe") return "#DC2626";
                      if (r === "textbox") return "#D97706";
                      if (r === "banner") return "#9333EA";
                      return "#6B7280";
                    })(),
                    borderRadius: 4,
                  }}
                />
                <div style={{ fontSize: 13 }}>{r}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 18 }}>
          <strong>Selected Node</strong>
          {!selectedNode && (
            <div style={{ color: "#666", marginTop: 8 }}>
              Click a node in the tree
            </div>
          )}
          {selectedNode && (
            <div style={{ marginTop: 8 }}>
              <div>
                <strong>id:</strong> {selectedNode.nodeId}
              </div>
              <div>
                <strong>role:</strong>{" "}
                {String(selectedNode.role?.value || "(none)")}
              </div>
              <div>
                <strong>name:</strong> {selectedNode.name?.value || "(empty)"}
              </div>
              <div style={{ marginTop: 8 }}>
                <strong>properties</strong>
                <pre
                  style={{
                    background: "#fff",
                    padding: 8,
                    borderRadius: 6,
                    maxHeight: 200,
                    overflow: "auto",
                  }}
                >
                  {JSON.stringify(selectedNode.properties || {}, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main visualizer */}
      <div style={{ flex: 1, padding: 12 }}>
        <ZoomableAXTree
          ref={vizRef}
          data={tree}
          highlightIds={highlightIds}
          filterRoles={
            new Set(
              Object.entries(roleFilters)
                .filter(([_, v]) => v)
                .map(([k]) => k)
            )
          }
          onSelectNode={(n) => setSelectedNode(n)}
        />
      </div>
    </div>
  );
}
