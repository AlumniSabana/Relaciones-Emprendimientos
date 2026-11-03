import { select } from "d3-selection";
import { zoom, zoomIdentity, type ZoomBehavior } from "d3-zoom";
import { memo, useEffect, useMemo, useRef } from "react";
import { buildAdjacency, sectorColors } from "../lib/graph";
import { computeLayout, MAX_RADIUS, type Point } from "../lib/layout";
import type { Company, Graph as GraphData, Selection } from "../types";

/** Pide centrar una empresa en pantalla; `key` cambia en cada petición para repetirla. */
export interface FocusRequest {
  id: string;
  key: number;
}

interface Props {
  graph: GraphData;
  selection: Selection;
  onSelect: (selection: Selection) => void;
  focus?: FocusRequest | null;
}

// Ancho que ocupa la tarjeta a la derecha (380 + márgenes): el centro útil del lienzo queda a su izquierda.
const CARD_SPACE = 412;
const FOCUS_SCALE = 1.6;
const MAX_LABEL = 28; // las etiquetas largas se pisan; el nombre completo queda en la ayuda emergente

interface NodeProps {
  id: string;
  name: string;
  x: number;
  y: number;
  fill?: string;
  selected?: boolean;
  onSelect: (selection: Selection) => void;
}

const Node = memo(function Node({ id, name, x, y, fill, selected, onSelect }: NodeProps) {
  return (
    <circle
      className={selected ? "node selected" : "node"}
      data-id={id}
      cx={x}
      cy={y}
      r={selected ? 8 : 5}
      fill={fill}
      onClick={(e) => {
        e.stopPropagation();
        onSelect({ type: "company", id });
      }}
    >
      <title>{name}</title>
    </circle>
  );
});

interface EdgeProps {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  stroke?: string;
  /** Conexión de respaldo (solo comparten sector): se dibuja punteada. */
  fallback?: boolean;
}

const EdgeLine = memo(function EdgeLine({ x1, y1, x2, y2, stroke, fallback }: EdgeProps) {
  const className = `edge${stroke ? " active" : ""}${fallback ? " fallback" : ""}`;
  return <line className={className} x1={x1} y1={y1} x2={x2} y2={y2} stroke={stroke} />;
});

export default function Graph({ graph, selection, onSelect, focus }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const viewportRef = useRef<SVGGElement>(null);
  const behaviorRef = useRef<ZoomBehavior<SVGSVGElement, unknown>>();

  const layout = useMemo(() => computeLayout(graph.nodes, graph.edges), [graph]);
  const adjacency = useMemo(() => buildAdjacency(graph.edges), [graph]);
  const colors = useMemo(() => sectorColors(graph.sectors), [graph]);
  const byId = useMemo(() => new Map(graph.nodes.map((n) => [n.id, n])), [graph]);

  // Mover y acercar se aplica directo al grupo SVG: no pasa por el estado de React.
  useEffect(() => {
    const svg = svgRef.current!;
    const size = () => [svg.clientWidth || 1000, svg.clientHeight || 700] as const;
    const behavior = zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 8])
      // Con 0 (por defecto) cualquier temblor del ratón cuenta como arrastre y se pierde el click.
      .clickDistance(4)
      .extent(() => [[0, 0], [...size()]])
      .on("zoom", (event) => viewportRef.current?.setAttribute("transform", event.transform.toString()));
    behaviorRef.current = behavior;
    const selection = select(svg).call(behavior).on("dblclick.zoom", null);
    const fit = () => {
      const [width, height] = size();
      const scale = Math.min(width, height) / (2 * (MAX_RADIUS + 40));
      selection.call(behavior.transform, zoomIdentity.translate(width / 2, height / 2).scale(scale));
    };
    // Se encuadra una sola vez, cuando el lienzo ya tiene tamaño real.
    let observer: ResizeObserver | undefined;
    if (typeof ResizeObserver === "undefined") {
      fit();
    } else {
      observer = new ResizeObserver(() => {
        if (!svg.clientWidth) return;
        observer?.disconnect();
        fit();
      });
      observer.observe(svg);
    }
    return () => {
      observer?.disconnect();
      selection.on(".zoom", null);
    };
  }, []);

  // Centra la empresa pedida en la parte visible del lienzo (la tarjeta tapa la derecha).
  useEffect(() => {
    const point = focus && layout.get(focus.id);
    const svg = svgRef.current;
    const behavior = behaviorRef.current;
    if (!point || !svg || !behavior) return;
    const width = svg.clientWidth || 1000;
    const height = svg.clientHeight || 700;
    // Centro de la parte libre; en lienzos estrechos no pasa del 20 % del ancho para no sacarla de la vista.
    const centerX = Math.max((width - CARD_SPACE) / 2, width * 0.2);
    const transform = zoomIdentity
      .translate(centerX - FOCUS_SCALE * point.x, height / 2 - FOCUS_SCALE * point.y)
      .scale(FOCUS_SCALE);
    select(svg).call(behavior.transform, transform);
  }, [focus?.key]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedCompany = selection?.type === "company" ? byId.get(selection.id) : undefined;
  const sectorName = selection?.type === "sector" ? selection.name : undefined;
  const neighborIds = selectedCompany ? adjacency.get(selectedCompany.id) ?? new Set<string>() : new Set<string>();
  const active = selectedCompany !== undefined || sectorName !== undefined;
  const focusColor = colors.get(selectedCompany?.sector ?? sectorName ?? "");

  // Empresas que quedan en primer plano: la elegida y sus vecinas, o todas las de un sector.
  const inFocus = (n: Company) =>
    selectedCompany
      ? n.id === selectedCompany.id || neighborIds.has(n.id)
      : sectorName !== undefined && n.sector === sectorName;
  const edgeInFocus = (a: string, b: string) =>
    selectedCompany
      ? a === selectedCompany.id || b === selectedCompany.id
      : sectorName !== undefined && byId.get(a)?.sector === sectorName && byId.get(b)?.sector === sectorName;

  const pos = (id: string): Point => layout.get(id)!;
  const renderNode = (n: Company) => {
    const { x, y } = pos(n.id);
    return (
      <Node
        key={n.id}
        id={n.id}
        name={n.name}
        x={x}
        y={y}
        fill={inFocus(n) ? colors.get(n.sector) : undefined}
        selected={n.id === selectedCompany?.id}
        onSelect={onSelect}
      />
    );
  };

  const baseEdges = graph.edges.filter((e) => !edgeInFocus(e.a, e.b));
  const focusEdges = graph.edges.filter((e) => edgeInFocus(e.a, e.b));
  const focusNodes = graph.nodes.filter(inFocus);
  const baseNodes = graph.nodes.filter((n) => !inFocus(n));

  return (
    <svg ref={svgRef} className="graph" onClick={() => onSelect(null)}>
      <g ref={viewportRef}>
        <g className={active ? "dimmed" : undefined}>
          {baseEdges.map((e) => (
            <EdgeLine
              key={`${e.a}-${e.b}`}
              x1={pos(e.a).x}
              y1={pos(e.a).y}
              x2={pos(e.b).x}
              y2={pos(e.b).y}
              fallback={e.fallback}
            />
          ))}
          {baseNodes.map(renderNode)}
        </g>
        {active && (
          <g className="focus">
            {focusEdges.map((e) => (
              <EdgeLine
                key={`${e.a}-${e.b}`}
                x1={pos(e.a).x}
                y1={pos(e.a).y}
                x2={pos(e.b).x}
                y2={pos(e.b).y}
                stroke={focusColor}
                fallback={e.fallback}
              />
            ))}
            {focusNodes.map(renderNode)}
            {selectedCompany &&
              focusNodes.map((n) => (
                <text key={n.id} className="label" x={pos(n.id).x} y={pos(n.id).y + 20}>
                  {n.name.length > MAX_LABEL ? `${n.name.slice(0, MAX_LABEL - 1)}…` : n.name}
                </text>
              ))}
          </g>
        )}
      </g>
    </svg>
  );
}
