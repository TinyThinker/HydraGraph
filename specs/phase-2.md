# Phase 2: Dual-Pane Split Layout & Ancestry Stream

## Scope
Partition the main viewport into a resizable split screen (Graph Minimap on left, Linear Chat Stream on right). Implement ancestor lineage traversal, markdown message rendering, and branch-aware prompt dispatching.

## Sequential Tasks
- Task 2.1: Implement lineage selector `getAncestryChain(nodes, selectedNodeId)` returning an ordered array `[rootNode, ..., selectedNode]`.
- Task 2.2: Build the split layout container partitioning the screen into a 40% Graph pane (left) and 60% Chat pane (right).
- Task 2.3: Build `ChatStreamView` in the right pane to render the ordered ancestry array using standard chat bubbles with full Markdown rendering and token telemetry metadata.
- Task 2.4: Wire the fixed bottom input bar so submitting a prompt dispatches an LLM call, creates a child node linked to `selectedNodeId`, and automatically shifts active selection to the new child.
- Task 2.5: Synchronize two-way selection: clicking any past message in `ChatStreamView` updates `selectedNodeId` and focuses that node on the graph.

## Passing Criteria
- Selecting any node $N$ on the graph renders only its direct ancestors `[root -> ... -> N]` in the right chat pane.
- Submitting a prompt while focused on an ancestor node successfully creates a new fork without overwriting existing sibling branches.
- Active response streaming renders smoothly in the right chat window without canvas lag.
- `npm run typecheck` and test suites pass.