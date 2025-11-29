// components/ZoomableAXTree.tsx
import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import * as d3 from "d3";
import type { AXNode } from "@/lib/buildTree";

export type VizHandle = {
  fitToScreen: () => void;
  focusNode: (nodeId: string) => void;
};

interface Props {
  data: AXNode;
  width?: number;
  height?: number;
  highlightIds?: Set<string>;
  filterRoles?: Set<string>;
  onSelectNode?: (node: AXNode | null) => void;
}

const colorByRole = (role?: string | number) => {
  if (!role) return "#FFFFFF";
  const r = String(role).toLowerCase();
  if (r.includes("heading")) return "#4F46E5";
  if (r.includes("button")) return "#059669";
  if (r.includes("link")) return "#2563EB";
  if (r.includes("iframe")) return "#DC2626";
  if (r.includes("textbox")) return "#D97706";
  if (r.includes("banner")) return "#9333EA";
  if (r.includes("generic")) return "#6B7280";
  return "#374151";
};

const ZoomableAXTree = forwardRef<VizHandle, Props>(
  (
    {
      data,
      width = 1200,
      height = 800,
      highlightIds = new Set(),
      filterRoles = new Set(),
      onSelectNode,
    },
    ref
  ) => {
    const svgRef = useRef<SVGSVGElement | null>(null);
    const gRef = useRef<SVGGElement | null>(null);
    const [layoutNodes, setLayoutNodes] = useState<any[]>([]); // for minimap
    const [layoutLinks, setLayoutLinks] = useState<any[]>([]);
    const zoomBehavior = useRef<any>(null);

    // Imperative methods
    useImperativeHandle(ref, () => ({
      fitToScreen: () => {
        if (!svgRef.current || !gRef.current) return;
        const svg = d3.select(svgRef.current);
        const g = d3.select(gRef.current);
        const bbox = g.node()?.getBBox();
        if (!bbox) return;
        const scale = Math.min(
          width / (bbox.width + 120),
          height / (bbox.height + 120),
          1
        );
        const tx = -bbox.x * scale + (width - bbox.width * scale) / 2;
        const ty = -bbox.y * scale + (height - bbox.height * scale) / 2;
        svg
          .transition()
          .duration(600)
          .call(
            zoomBehavior.current.transform,
            d3.zoomIdentity.translate(tx, ty).scale(scale)
          );
      },
      focusNode: (nodeId: string) => {
        if (!svgRef.current || !gRef.current) return;
        const node = layoutNodes.find((n) => n.data.nodeId === nodeId);
        if (!node) return;
        const svg = d3.select(svgRef.current);
        const scale = 1.2;
        const tx = width / 2 - node.y * scale;
        const ty = height / 2 - node.x * scale;
        svg
          .transition()
          .duration(700)
          .call(
            zoomBehavior.current.transform,
            d3.zoomIdentity.translate(tx, ty).scale(scale)
          );
      },
    }));

    useEffect(() => {
      if (!svgRef.current) return;

      // Clear
      d3.select(svgRef.current).selectAll("*").remove();

      // Setup zoom
      const svg = d3
        .select(svgRef.current)
        .attr("width", width)
        .attr("height", height);

      const g = svg.append("g").attr("class", "container");
      gRef.current = g.node();

      const zoom = d3
        .zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.1, 4])
        .on("zoom", (event) => {
          g.attr("transform", event.transform as any);
        });
      zoomBehavior.current = zoom;
      svg.call(zoom as any);

      // Build d3 hierarchy & layout
      const root = d3.hierarchy<AXNode>(data, (d) => {
        // apply role filters: only return children that match filter OR whose descendants match
        if (!d.children) return d.children || [];
        if (filterRoles.size === 0) return d.children;
        // include child if role matches or there exists descendant which matches
        const filtered = d.children.filter((c) => {
          const roleStr = String(c.role?.value || "").toLowerCase();
          if (filterRoles.has(roleStr)) return true;
          // quick descendant check (depth-first)
          let stack = [c];
          while (stack.length) {
            const cur = stack.pop()!;
            if (filterRoles.has(String(cur.role?.value || "").toLowerCase()))
              return true;
            if (cur.children) stack.push(...cur.children);
          }
          return false;
        });
        return filtered;
      });

      const treeLayout = d3.tree<AXNode>().size([height - 80, width - 260]);
      treeLayout(root as any);

      // Export nodes/links for minimap + focus
      setLayoutNodes(
        root.descendants().map((d) => ({
          x: d.x,
          y: d.y,
          data: d.data,
          depth: d.depth,
          children: d.children,
        }))
      );
      setLayoutLinks(
        root.links().map((l) => ({ source: l.source, target: l.target }))
      );

      // Links
      g.selectAll(".link")
        .data(root.links())
        .join("path")
        .attr("class", "link")
        .attr("fill", "none")
        .attr("stroke", "#ccc")
        .attr("stroke-width", 1.2)
        .attr(
          "d",
          d3
            .linkHorizontal()
            .x((d: any) => d.y)
            .y((d: any) => d.x) as any
        );

      // Nodes
      const nodeG = g
        .selectAll(".node")
        .data(
          root.descendants().filter((d) => {
            const roleStr = String(d.data.role?.value || "").toLowerCase();
            return roleStr && roleStr !== "generic" && roleStr !== "none";
          })
        )
        .join("g")
        .attr("class", "node")
        .attr("transform", (d) => `translate(${d.y},${d.x})`)
        .style("cursor", "pointer")
        .on("click", (event, d) => {
          onSelectNode?.(d.data);
        });

      // circle with highlight if in highlightIds or ignored
      nodeG
        .append("circle")
        .attr("r", 8)
        .attr("fill", (d) => colorByRole(d.data.role?.value))
        .attr("stroke", (d) =>
          highlightIds.has(d.data.nodeId)
            ? "#FFD54F"
            : d.data.ignored
            ? "#ccc"
            : "#fff"
        )
        .attr("stroke-width", (d) => (highlightIds.has(d.data.nodeId) ? 4 : 1));

      nodeG
        .append("text")
        .attr("dy", "0.35em")
        .attr("x", (d) => (d.children ? -12 : 12))
        .attr("text-anchor", (d) => (d.children ? "end" : "start"))
        .text((d) => {
          const r = d.data.role?.value || "node";
          const n = d.data.name?.value
            ? ` ${String(d.data.name.value).slice(0, 28)}`
            : "";
          return `${r}${n}`;
        })
        .style("font", "11px sans-serif")
        .style("pointer-events", "none");

      // initial fit
      setTimeout(() => {
        // small delay for DOM
        const bbox = g.node()?.getBBox();
        if (bbox) {
          const scale = Math.min(
            width / (bbox.width + 120),
            height / (bbox.height + 120),
            1
          );
          const tx = -bbox.x * scale + (width - bbox.width * scale) / 2;
          const ty = -bbox.y * scale + (height - bbox.height * scale) / 2;
          svg.call(
            zoom.transform as any,
            d3.zoomIdentity.translate(tx, ty).scale(scale)
          );
        }
      }, 50);

      // cleanup on unmount
      return () => {
        svg.on(".zoom", null);
      };
    }, [data, highlightIds, filterRoles, width, height, onSelectNode]);

    // Render minimap (small SVG) below main svg
    const minimapScale = 0.12;
    const minimapWidth = Math.max(180, Math.min(320, width * minimapScale));
    const minimapHeight = Math.max(120, Math.min(200, height * minimapScale));

    return (
      <div style={{ display: "flex", gap: 12 }}>
        <svg
          ref={svgRef}
          style={{ border: "1px solid #e5e7eb", borderRadius: 8 }}
        />
        <div style={{ width: 240 }}>
          <div style={{ marginBottom: 8 }}>
            <strong>Mini-map</strong>
            <div style={{ fontSize: 12, color: "#666" }}>
              Click a node to center
            </div>
          </div>

          <svg
            width={minimapWidth}
            height={minimapHeight}
            style={{
              border: "1px solid #ddd",
              background: "#fff",
              borderRadius: 6,
            }}
          >
            <g
              transform={`translate(6,6) scale(${Math.min(
                minimapWidth /
                  Math.max(1, d3.max(layoutNodes, (n: any) => n.y) || 1),
                minimapHeight /
                  Math.max(1, d3.max(layoutNodes, (n: any) => n.x) || 1)
              )})`}
            >
              {/* links */}
              {layoutLinks.map((l, i) => (
                <path
                  key={i}
                  d={
                    d3.linkHorizontal()({
                      source: {
                        x: (l.source as any).y,
                        y: (l.source as any).x,
                      },
                      target: {
                        x: (l.target as any).y,
                        y: (l.target as any).x,
                      },
                    } as any) as string
                  }
                  fill='none'
                  stroke='#ddd'
                  strokeWidth={1}
                />
              ))}
              {/* nodes */}
              {layoutNodes.map((n, i) => {
                const cx = n.y;
                const cy = n.x;
                const fill = colorByRole(n.data.role?.value);
                const isHighlighted = highlightIds.has(n.data.nodeId);
                return (
                  <g
                    key={n.data.nodeId}
                    transform={`translate(${cx},${cy})`}
                    style={{ cursor: "pointer" }}
                    onClick={() => {
                      // fire focus in parent via DOM event -> parent can call imperative focus
                      const event = new CustomEvent("minimap-focus", {
                        detail: { nodeId: n.data.nodeId },
                      });
                      window.dispatchEvent(event);
                    }}
                  >
                    <circle
                      r={isHighlighted ? 3.5 : 2.5}
                      fill={fill}
                      stroke={isHighlighted ? "#FFD54F" : "#fff"}
                      strokeWidth={isHighlighted ? 1.2 : 0}
                    />
                  </g>
                );
              })}
            </g>
          </svg>
        </div>
      </div>
    );
  }
);

export default ZoomableAXTree;
