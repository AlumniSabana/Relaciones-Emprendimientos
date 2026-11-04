import { select } from "d3-selection";
import { zoom, zoomIdentity, type ZoomBehavior } from "d3-zoom";
import { memo, useEffect, useMemo, useRef } from "react";
import { ALL_NEIGHBORS, visibleConnections, type NeighborFilter } from "../lib/connections";
import { sectorColors } from "../lib/graph";
import { computeLayout, type Point } from "../lib/layout";
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
  /** Se llama en cada movimiento de zoom con el acercamiento respecto al encuadre inicial (1 = inicial). */
  onZoom?: (ratio: number) => void;
  /** Con una empresa elegida, solo se resaltan las conexiones que cumplen el filtro. */
  neighborFilter?: NeighborFilter;
}

// Ancho que ocupa la tarjeta a la derecha (380 + márgenes): el centro útil del lienzo queda a su izquierda.
const CARD_SPACE = 412;
const FOCUS_SCALE = 1.6;
const MAX_LABEL = 28; // las etiquetas largas se pisan; el nombre completo queda en la ayuda emergente
const TOP_LABELS = 10; // con un sector elegido se rotulan las 10 empresas con más información
const DEFAULT_HEADER = 96; // alto del encabezado si no se puede leer --header-h (styles.css)

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

export default function Graph({ graph, selection, onSelect, focus, onZoom, neighborFilter = ALL_NEIGHBORS }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const viewportRef = useRef<SVGGElement>(null);
  const behaviorRef = useRef<ZoomBehavior<SVGSVGElement, unknown>>();
  const fitScaleRef = useRef(0);
  const fitRef = useRef<() => void>();
  const extentRef = useRef(1);
  const firstGraph = useRef(true);
  const onZoomRef = useRef(onZoom);
  onZoomRef.current = onZoom;

  const layout = useMemo(() => computeLayout(graph.nodes, graph.edges), [graph]);
  // Radio real del grafo (más 40 de margen): con pocas empresas el grafo es más chico y se encuadra más cerca.
  extentRef.current = useMemo(
    () => Math.max(1, ...[...layout.values()].map((p) => Math.hypot(p.x, p.y))) + 40,
    [layout],
  );
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
      .on("zoom", (event) => {
        viewportRef.current?.setAttribute("transform", event.transform.toString());
        // Las etiquetas compensan el zoom (styles.css) para leerse igual con el grafo completo o acercado.
        svg.style.setProperty("--k", String(event.transform.k));
        if (fitScaleRef.current) onZoomRef.current?.(event.transform.k / fitScaleRef.current);
      });
    behaviorRef.current = behavior;
    const selection = select(svg).call(behavior).on("dblclick.zoom", null);
    const fit = () => {
      const [width, height] = size();
      // El encabezado ocupa la franja de arriba: el grafo se centra en lo que queda libre.
      const top = parseFloat(getComputedStyle(svg).getPropertyValue("--header-h")) || DEFAULT_HEADER;
      const usable = Math.max(height - top, 1);
      const scale = Math.min(width, usable) / (2 * extentRef.current);
      fitScaleRef.current = scale;
      selection.call(behavior.transform, zoomIdentity.translate(width / 2, top + usable / 2).scale(scale));
    };
    fitRef.current = fit;
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

  // Un grafo nuevo (por ejemplo, al filtrar) vuelve al encuadre inicial; el primero ya lo encuadra el efecto de arriba.
  useEffect(() => {
    if (firstGraph.current) {
      firstGraph.current = false;
      return;
    }
    fitRef.current?.();
  }, [graph]);

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
    // Con pocas empresas el encuadre ya está muy cerca: el acercamiento es relativo a él.
    const scale = Math.max(FOCUS_SCALE, fitScaleRef.current * FOCUS_SCALE);
    const transform = zoomIdentity
      .translate(centerX - scale * point.x, height / 2 - scale * point.y)
      .scale(scale);
    select(svg).call(behavior.transform, transform);
  }, [focus?.key]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedCompany = selection?.type === "company" ? byId.get(selection.id) : undefined;
  const sectorName = selection?.type === "sector" ? selection.name : undefined;
  // Vecinas que se resaltan: las conexiones de la empresa que cumplen el filtro (por defecto, todas).
  const neighborIds = new Set(
    selectedCompany ? visibleConnections(selectedCompany, graph.edges, byId, neighborFilter).map((c) => c.other) : [],
  );
  const active = selectedCompany !== undefined || sectorName !== undefined;
  const focusColor = colors.get(selectedCompany?.sector ?? sectorName ?? "");

  // Empresas que quedan en primer plano: la elegida y sus vecinas, o todas las de un sector.
  const inFocus = (n: Company) =>
    selectedCompany
      ? n.id === selectedCompany.id || neighborIds.has(n.id)
      : sectorName !== undefined && n.sector === sectorName;
  const edgeInFocus = (a: string, b: string) =>
    selectedCompany
      ? (a === selectedCompany.id && neighborIds.has(b)) || (b === selectedCompany.id && neighborIds.has(a))
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
  // Con una empresa elegida se rotulan ella y sus vecinas; con un sector, las 10 con más información
  // (rank más bajo), con el nombre como si estuvieran seleccionadas pero sin abrir su tarjeta.
  const labelNodes = selectedCompany
    ? focusNodes
    : [...focusNodes].sort((a, b) => a.rank - b.rank).slice(0, TOP_LABELS);

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
            {labelNodes.map((n) => (
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
