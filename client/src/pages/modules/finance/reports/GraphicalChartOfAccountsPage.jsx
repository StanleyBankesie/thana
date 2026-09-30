/**
 * @fileoverview GraphicalChartOfAccountsPage component.
 * Provides functionality for GraphicalChartOfAccountsPage.
 */

import React, { useEffect, useState, useCallback, useMemo } from "react";
import ReactFlow, {
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  MarkerType,
  MiniMap,
  Position,
} from "reactflow";
import "reactflow/dist/style.css";
import dagre from "dagre";
import {
  Card,
  Button,
  Typography,
  Breadcrumb,
  Spin,
  Empty,
  Switch,
  Tooltip,
  Input,
} from "antd";
import {
  NodeIndexOutlined,
  LeftOutlined,
  ReloadOutlined,
  ArrowsAltOutlined,
  ColumnWidthOutlined,
  ColumnHeightOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import { api } from "../../../../api/client.js";
import { Guard } from "../../../../hooks/usePermissions.jsx";
import { Link } from "react-router-dom";
import ChartNode from "./components/ChartNode.jsx";

const { Text } = Typography;

// Custom node types
const nodeTypes = {
  chartNode: ChartNode,
};

// Dagre layouting
const dagreGraph = new dagre.graphlib.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({}));

const nodeWidth = 420;
const nodeHeight = 280;

const getLayoutedElements = (nodes, edges, direction = "TB") => {
  const isHorizontal = direction === "LR";
  dagreGraph.setGraph({
    rankdir: direction,
    ranksep: 100, // Balanced vertical space
    nodesep: 60, // Balanced horizontal space
  });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    node.targetPosition = isHorizontal ? Position.Left : Position.Top;
    node.sourcePosition = isHorizontal ? Position.Right : Position.Bottom;

    node.position = {
      x: nodeWithPosition.x - nodeWidth / 2,
      y: nodeWithPosition.y - nodeHeight / 2,
    };

    return node;
  });

  return { nodes: layoutedNodes, edges };
};

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function GraphicalChartOfAccountsPage() {
  const [pollingCounter, setPollingCounter] = React.useState(0);
  React.useEffect(() => {
    const __pollId = setInterval(() => setPollingCounter(c => c + 1), 15000);
    return () => clearInterval(__pollId);
  }, [pollingCounter]);

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [loading, setLoading] = useState(false);
  const [direction, setDirection] = useState("TB");
  const [searchValue, setSearchValue] = useState("");
  const miniMapNodeColor = useCallback((node) => {
    const nature = String(node?.data?.nature || "").toUpperCase();
    if (nature === "ASSET") return "#10b981";
    if (nature === "LIABILITY") return "#f43f5e";
    if (nature === "EQUITY") return "#6366f1";
    if (nature === "INCOME") return "#3b82f6";
    if (nature === "EXPENSE") return "#f59e0b";
    return "#94a3b8";
  }, []);

  const transformData = (data, search = "") => {
    const flatNodes = [];
    const flatEdges = [];

    // Helper to check if node or any child matches search
    const matchesSearch = (item) => {
      if (!search) return true;
      const term = search.toLowerCase();
      if (
        item.name?.toLowerCase().includes(term) ||
        item.code?.toLowerCase().includes(term) ||
        item.title?.toLowerCase().includes(term)
      )
        return true;
      return item.children?.some((child) => matchesSearch(child));
    };

    const traverse = (items, parentId = null, nature = null) => {
      items.forEach((item) => {
        const currentNature = item.isNature
          ? item.title
          : nature || item.nature;
        const isMatched = !search || matchesSearch(item);

        flatNodes.push({
          id: item.key,
          type: "chartNode",
          data: {
            label: item.isNature ? item.title : item.name || item.title,
            code: item.code,
            nature: currentNature,
            isNature: !!item.isNature,
            isGroup: !item.isNature && !item.isAccount,
            isAccount: !!item.isAccount,
            highlighted: search ? isMatched : null,
          },
          draggable: false, // Force non-draggable
          position: { x: 0, y: 0 },
        });

        if (parentId) {
          flatEdges.push({
            id: `edge-${parentId}-${item.key}`,
            source: parentId,
            target: item.key,
            type: "smoothstep",
            animated: !!(search && isMatched), // Animate path to search results
            style: {
              stroke: isMatched ? "#6366f1" : "#e2e8f0",
              strokeWidth: isMatched ? 2 : 1,
            },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: isMatched ? "#6366f1" : "#e2e8f0",
            },
          });
        }

        if (item.children && item.children.length > 0) {
          traverse(item.children, item.key, currentNature);
        }
      });
    };

    traverse(data);
    return { flatNodes, flatEdges };
  };

  const load = async (search = searchValue) => {
    setLoading(true);
    try {
      const res = await api.get("/finance/reports/chart-of-accounts-graphical");
      const { flatNodes, flatEdges } = transformData(
        res.data?.items || [],
        search,
      );

      const { nodes: layoutedNodes, edges: layoutedEdges } =
        getLayoutedElements(flatNodes, flatEdges, direction);

      setNodes([...layoutedNodes]);
      setEdges([...layoutedEdges]);
    } catch (err) {
      console.error("Failed to load graphical COA", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [direction, pollingCounter]);

  const onSearch = (e) => {
    const val = e.target.value;
    setSearchValue(val);
    load(val);
  };

  return (
    <Guard moduleKey="finance">
      <div className="flex flex-col h-screen bg-slate-50 dark:bg-slate-900 overflow-hidden font-sans">
        {/* Modern ERP Header */}
        <div className="px-8 py-5 bg-white border-b border-slate-200 flex items-center justify-between shadow-sm z-30">
          <div className="flex items-center gap-6">
            <Link
              to="/finance?section=Reports%20%26%20Analysis"
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-50 text-slate-400 hover:text-indigo-600 transition-all border border-slate-100 hover:border-indigo-100 shadow-inner"
            >
              <LeftOutlined />
            </Link>
            <div>
              <h1 className="text-xl font-black text-slate-800 m-0 tracking-tight">
                Financial Hierarchy
              </h1>
              <p className="text-[18px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                Graphical Chart of Accounts
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Input
              placeholder="Search Accounts..."
              prefix={<SearchOutlined className="text-slate-300" />}
              className="w-64 h-11 rounded-xl border-slate-200 bg-slate-50 focus:bg-white transition-all shadow-inner"
              onChange={onSearch}
              allowClear
            />
            <div className="h-8 w-[1px] bg-slate-100 mx-2" />
            <Button
              type="primary"
              onClick={() => load()}
              loading={loading}
              icon={<ReloadOutlined />}
              className="h-11 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-700 border-none shadow-md shadow-indigo-200 font-bold flex items-center"
            >
              Refresh Data
            </Button>
          </div>
        </div>

        {/* Graph Section */}
        <div className="flex-1 relative bg-[#f8fafc]">
          {loading && (
            <div className="absolute inset-0 z-10 bg-white/60 backdrop-blur-md flex items-center justify-center">
              <div className="flex flex-col items-center gap-4">
                <Spin size="large" />
                <Text className="text-indigo-600 font-bold tracking-widest text-[16px] uppercase">
                  Processing Ledger Hierarchy...
                </Text>
              </div>
            </div>
          )}

          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            nodeTypes={nodeTypes}
            defaultViewport={{ x: 0, y: 0, zoom: 1 }}
            minZoom={0.001}
            maxZoom={100}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={true}
            panOnDrag={true}
            zoomOnScroll={true}
            zoomOnPinch={true}
            zoomOnDoubleClick={true}
            className="chart-viewer"
          >
            <MiniMap
              position="top-left"
              pannable
              zoomable
              offsetScale={0}
              nodeColor={miniMapNodeColor}
              nodeBorderRadius={4}
              nodeStrokeWidth={2}
              maskColor="rgba(59, 130, 246, 0.16)"
              className="!w-[300px] !h-[180px] !rounded-xl !border-0 !bg-transparent !shadow-none !p-0 !m-0"
            />
            <Controls className="!bg-white !shadow-xl !rounded-xl !border-none !p-1" />
            <Background
              variant="lines"
              gap={40}
              size={1}
              color="#e5e7eb"
              className="opacity-50"
            />
          </ReactFlow>

          {/* View Controls Overlay */}
          <div className="absolute top-6 right-8 flex items-center gap-2 z-20">
            <Button
              onClick={() => setDirection(direction === "TB" ? "LR" : "TB")}
              className="h-10 rounded-xl bg-white border-slate-200 shadow-sm text-[12px] font-bold text-slate-500 hover:text-indigo-600"
            >
              {direction === "TB"
                ? "SWITCH TO HORIZONTAL"
                : "SWITCH TO VERTICAL"}
            </Button>
          </div>
        </div>
      </div>
      <style>{`
        .chart-viewer .react-flow__edge-path {
          stroke: #cbd5e1;
        }
        .chart-viewer .react-flow__edge.animated .react-flow__edge-path {
          stroke: #6366f1;
          stroke-dasharray: 5;
          animation: dashdraw 0.5s linear infinite;
        }
        @keyframes dashdraw {
          from { stroke-dashoffset: 10; }
          to { stroke-dashoffset: 0; }
        }
        .react-flow__handle {
          width: 8px !important;
          height: 8px !important;
          background: #cbd5e1 !important;
          border: 2px solid white !important;
        }
        .react-flow__controls-button {
          border-bottom: 1px solid #f1f5f9 !important;
        }
      `}</style>
    </Guard>
  );
}
