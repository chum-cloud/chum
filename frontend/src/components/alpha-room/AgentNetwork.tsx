import { useRef, useEffect, useState } from 'react';
import type { AgentInfo } from '../../lib/protocol';
import { truncateAddress, MSG_COLORS } from '../../lib/protocol';

interface Props {
  agents: AgentInfo[];
}

interface Node {
  x: number;
  y: number;
  vx: number;
  vy: number;
  address: string;
  messageCount: number;
  lastSeen: number;
}

const WIDTH = 300;
const HEIGHT = 220;
const NODE_COLORS = [MSG_COLORS.ALPHA, MSG_COLORS.SIGNAL, MSG_COLORS.RALLY, MSG_COLORS.RESULT, MSG_COLORS.EXIT];

export default function AgentNetwork({ agents }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const nodesRef = useRef<Node[]>([]);
  const animRef = useRef<number>(0);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [, setTick] = useState(0);

  // Initialize / update nodes when agents change
  useEffect(() => {
    const existing = new Map(nodesRef.current.map(n => [n.address, n]));
    const newNodes: Node[] = agents.map((agent, i) => {
      const prev = existing.get(agent.address);
      if (prev) {
        prev.messageCount = agent.messageCount;
        prev.lastSeen = agent.lastSeen;
        return prev;
      }
      // Place new nodes in a circle
      const angle = (i / Math.max(agents.length, 1)) * Math.PI * 2;
      const r = 60;
      return {
        x: WIDTH / 2 + Math.cos(angle) * r,
        y: HEIGHT / 2 + Math.sin(angle) * r,
        vx: 0,
        vy: 0,
        address: agent.address,
        messageCount: agent.messageCount,
        lastSeen: agent.lastSeen,
      };
    });
    nodesRef.current = newNodes;
  }, [agents]);

  // Physics simulation
  useEffect(() => {
    let running = true;

    function simulate() {
      if (!running) return;
      const nodes = nodesRef.current;
      if (nodes.length === 0) {
        animRef.current = requestAnimationFrame(simulate);
        return;
      }

      // Repulsion between all pairs
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[j].x - nodes[i].x;
          const dy = nodes[j].y - nodes[i].y;
          const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
          const force = 800 / (dist * dist);
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          nodes[i].vx -= fx;
          nodes[i].vy -= fy;
          nodes[j].vx += fx;
          nodes[j].vy += fy;
        }
      }

      // Center gravity
      for (const node of nodes) {
        const dx = WIDTH / 2 - node.x;
        const dy = HEIGHT / 2 - node.y;
        node.vx += dx * 0.005;
        node.vy += dy * 0.005;
      }

      // Apply velocity with damping
      for (const node of nodes) {
        node.vx *= 0.85;
        node.vy *= 0.85;
        node.x += node.vx;
        node.y += node.vy;
        // Bounds
        node.x = Math.max(20, Math.min(WIDTH - 20, node.x));
        node.y = Math.max(20, Math.min(HEIGHT - 20, node.y));
      }

      setTick(t => t + 1);
      animRef.current = requestAnimationFrame(simulate);
    }

    animRef.current = requestAnimationFrame(simulate);
    return () => {
      running = false;
      cancelAnimationFrame(animRef.current);
    };
  }, []);

  const nodes = nodesRef.current;
  const now = Math.floor(Date.now() / 1000);

  return (
    <div className="bg-[#111620] border border-[#2a3040] rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-[#2a3040] flex items-center justify-between">
        <h3 className="text-sm font-bold text-gray-200">Agent Network</h3>
        <span className="text-xs text-gray-500">{agents.length} agents</span>
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full"
        style={{ background: 'radial-gradient(circle at center, #111620, #0c0f14)' }}
      >
        {/* Edges — connect nodes that are close */}
        {nodes.map((a, i) =>
          nodes.slice(i + 1).map((b) => {
            const dist = Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
            if (dist > 120) return null;
            const opacity = Math.max(0, 1 - dist / 120) * 0.3;
            return (
              <line
                key={`${a.address}-${b.address}`}
                x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                stroke="#22d3ee"
                strokeWidth={0.5}
                opacity={opacity}
              />
            );
          })
        )}

        {/* Nodes */}
        {nodes.map((node, i) => {
          const r = 4 + Math.min(node.messageCount * 1.5, 8);
          const color = NODE_COLORS[i % NODE_COLORS.length];
          const isRecent = now - node.lastSeen < 600; // last 10 min
          const isHovered = hoveredNode === node.address;

          return (
            <g key={node.address}>
              {/* Glow for recent nodes */}
              {isRecent && (
                <circle cx={node.x} cy={node.y} r={r + 3} fill={color} opacity={0.15}>
                  <animate
                    attributeName="r"
                    values={`${r + 2};${r + 5};${r + 2}`}
                    dur="2s"
                    repeatCount="indefinite"
                  />
                  <animate
                    attributeName="opacity"
                    values="0.15;0.05;0.15"
                    dur="2s"
                    repeatCount="indefinite"
                  />
                </circle>
              )}
              <circle
                cx={node.x}
                cy={node.y}
                r={isHovered ? r + 2 : r}
                fill={color}
                opacity={0.8}
                className="cursor-pointer transition-all"
                onMouseEnter={() => setHoveredNode(node.address)}
                onMouseLeave={() => setHoveredNode(null)}
              />
              {/* Label on hover */}
              {isHovered && (
                <text
                  x={node.x}
                  y={node.y - r - 6}
                  textAnchor="middle"
                  fill="#e2e8f0"
                  fontSize={8}
                  fontFamily="JetBrains Mono, monospace"
                >
                  {truncateAddress(node.address)} ({node.messageCount})
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
