import { useCallback, useRef } from 'react';
import {
  ReactFlow, Background, Controls, MiniMap,
  addEdge, useNodesState, useEdgesState,
  type OnConnect, type NodeTypes, type Connection,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { WorkflowNode, WorkflowEdge, WorkflowNodeData, WorkflowNodeType } from '@/types/workflow';
import { StageNode } from './nodes/StageNode';
import { StartEndNode } from './nodes/StartEndNode';
import { DecisionNode } from './nodes/DecisionNode';
import { DelayNode } from './nodes/DelayNode';
import { NotifyNode } from './nodes/NotifyNode';

const NODE_TYPES: NodeTypes = {
  start:    StartEndNode,
  end:      StartEndNode,
  stage:    StageNode,
  decision: DecisionNode,
  delay:    DelayNode,
  notify:   NotifyNode,
};

interface Props {
  initialNodes: WorkflowNode[];
  initialEdges: WorkflowEdge[];
  readOnly?: boolean;
  onNodeClick?: (node: WorkflowNode) => void;
  onChange?: (nodes: WorkflowNode[], edges: WorkflowEdge[]) => void;
}

let nodeIdCounter = Date.now();
function newNodeId() { return `node_${++nodeIdCounter}`; }

export function WorkflowCanvas({ initialNodes, initialEdges, readOnly, onNodeClick, onChange }: Props) {
  const [nodes, setNodes, onNodesChange] = useNodesState<WorkflowNode>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<WorkflowEdge>(initialEdges);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);

  const onConnect: OnConnect = useCallback((params: Connection) => {
    setEdges(eds => {
      const next = addEdge(params, eds);
      onChange?.(nodes, next);
      return next;
    });
  }, [nodes, onChange, setEdges]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const type = e.dataTransfer.getData('application/reactflow') as WorkflowNodeType;
    if (!type || !reactFlowWrapper.current) return;
    const bounds = reactFlowWrapper.current.getBoundingClientRect();
    const position = { x: e.clientX - bounds.left - 80, y: e.clientY - bounds.top - 20 };
    const newNode: WorkflowNode = {
      id: newNodeId(),
      type,
      position,
      data: { label: type === 'stage' ? 'ขั้นตอนใหม่' : type, nodeType: type } as WorkflowNodeData,
    };
    setNodes(ns => {
      const next = [...ns, newNode];
      onChange?.(next, edges);
      return next;
    });
  }, [edges, onChange, setNodes]);

  return (
    <div ref={reactFlowWrapper} className="flex-1 h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        onNodesChange={readOnly ? undefined : onNodesChange}
        onEdgesChange={readOnly ? undefined : onEdgesChange}
        onConnect={readOnly ? undefined : onConnect}
        onDrop={readOnly ? undefined : onDrop}
        onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
        onNodeClick={(_, node) => onNodeClick?.(node as WorkflowNode)}
        fitView
      >
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  );
}
