import { useTreeStore } from '../store/useTreeStore'
import type { TurnNode } from '../types'

// Module-level state
const counts: Record<string, number> = {}
let enabled = false

export function enableRenderTally() {
  enabled = true
  if (typeof window !== 'undefined') {
    window.__hydraRenderTallyOn = true
  }
}

export function disableRenderTally() {
  enabled = false
  if (typeof window !== 'undefined') {
    window.__hydraRenderTallyOn = false
  }
}

export function resetRenderTally() {
  for (const key of Object.keys(counts)) {
    delete counts[key]
  }
}

export function getRenderTally(): Record<string, number> {
  return { ...counts }
}

export function bumpRenderTally(id: string) {
  if (!enabled) return
  counts[id] = (counts[id] ?? 0) + 1
}

export function useRenderTally(id: string) {
  bumpRenderTally(id)
}

// ========== DEV-ONLY SEEDER ==========

async function seedFiftyNodes() {
  const state = useTreeStore.getState()
  const { activeTreeId, settings, nodes } = state
  const { addNode } = state

  if (!activeTreeId) {
    console.error('seedFiftyNodes: no active tree')
    return
  }

  // Find root (parentId === null)
  let root: TurnNode | undefined
  for (const node of nodes.values()) {
    if (node.parentId === null) {
      root = node
      break
    }
  }

  if (!root) {
    console.error('seedFiftyNodes: no root node found')
    return
  }

  const SEED_TEXT_PROMPTS = [
    'What are the key principles of machine learning?',
    'Explain quantum computing in simple terms.',
    'How does photosynthesis work at a molecular level?',
    'What is the future of artificial intelligence?',
    'Describe the impact of climate change on ocean ecosystems.',
    'How do neural networks learn patterns?',
    'What are the benefits of renewable energy?',
    'Explain the theory of relativity.',
    'How does the human brain process language?',
    'What are the challenges in biomedical engineering?',
  ]

  const SEED_TEXT_RESPONSES = [
    'Machine learning is a subset of artificial intelligence that enables systems to learn from data. The key principles include supervised learning, where models train on labeled data; unsupervised learning, which finds patterns in unlabeled data; and reinforcement learning, where agents learn through interaction with an environment. These approaches power applications from image recognition to natural language processing. Modern deep learning uses neural networks with multiple layers to achieve remarkable accuracy across diverse domains.',

    'Quantum computing leverages the principles of quantum mechanics to process information in fundamentally different ways than classical computers. Unlike classical bits that are either 0 or 1, quantum bits (qubits) can exist in superposition, representing both 0 and 1 simultaneously. This allows quantum computers to explore multiple solutions in parallel. Additionally, quantum entanglement enables qubits to be correlated in ways that have no classical equivalent, further amplifying computational power for certain problem classes like factorization and optimization.',

    'Photosynthesis is the process by which plants convert light energy into chemical energy stored in glucose. The process occurs in two main stages: the light-dependent reactions in the thylakoid membranes of chloroplasts, where water is split and photons excite electrons, producing ATP and NADPH; and the light-independent reactions (Calvin cycle) in the stroma, where these molecules are used to fix carbon dioxide into glucose. This remarkable process is responsible for producing most of the oxygen in Earth\'s atmosphere.',

    'Artificial intelligence is advancing rapidly, with future directions including greater integration into everyday life, improved safety and interpretability, and new applications in healthcare, scientific discovery, and climate modeling. Challenges include addressing bias in AI systems, ensuring privacy in data-driven approaches, and aligning advanced AI systems with human values. The field is moving toward more general intelligence, multimodal systems that integrate vision, language, and reasoning, and AI assistants that can handle increasingly complex tasks with minimal human supervision.',

    'Climate change profoundly affects ocean ecosystems through multiple mechanisms. Rising temperatures alter ocean stratification and reduce nutrient mixing, impacting phytoplankton productivity that forms the base of marine food webs. Ocean acidification, caused by increased CO2 absorption, threatens calcifying organisms like corals, mollusks, and crustaceans. Warming waters cause poleward migration of fish species, disrupting established ecosystems and fisheries. Additionally, deoxygenation creates dead zones where marine life cannot survive, particularly in upwelling regions and coastal areas.',

    'Neural networks learn patterns through a process called backpropagation, which adjusts the weights of connections between neurons to minimize prediction error. During training, data flows through the network in a forward pass, generating predictions. The difference between predictions and true labels is quantified as a loss function. The gradient of this loss with respect to each weight is computed using the chain rule, flowing backward through the network. Weights are then adjusted proportionally to these gradients, gradually improving the network\'s ability to capture patterns in the training data.',

    'Renewable energy offers numerous environmental and economic benefits. Solar and wind power generate electricity without greenhouse gas emissions or air pollution, reducing climate impact. Unlike fossil fuels, renewables are inexhaustible on human timescales. They create distributed power generation, reducing transmission losses and improving grid resilience. Renewable industries generate jobs in manufacturing, installation, and maintenance. As technology costs decrease, renewables become increasingly cost-competitive, even without subsidies. However, challenges remain in energy storage, grid integration, and managing intermittency.',

    'Einstein\'s theory of relativity revolutionized our understanding of space, time, gravity, and energy. Special relativity, published in 1905, shows that time and space are relative to the observer\'s reference frame, leading to famous predictions like time dilation and length contraction. The equivalence of mass and energy is expressed in E=mc². General relativity, published in 1915, describes gravity not as a force but as the curvature of spacetime caused by massive objects. This geometric framework explains phenomena from planetary orbits to black holes to the expansion of the universe.',

    'The human brain processes language through distributed networks involving multiple regions. Broca\'s area in the left frontal lobe handles speech production and grammatical processing, while Wernicke\'s area in the temporal lobe processes spoken language comprehension. The angular gyrus integrates information across sensory and language areas. Modern neuroimaging reveals that language comprehension involves not just traditional language areas but also regions associated with motor control, suggesting we understand language by mentally simulating described actions. Language processing is highly context-dependent and integrates semantic, syntactic, and pragmatic information.',

    'Biomedical engineering tackles complex challenges at the intersection of medicine and technology. Key areas include designing prosthetics and orthotics that restore mobility, developing artificial organs and tissue scaffolds, creating diagnostic imaging systems with improved resolution and safety, and engineering drug delivery systems that target specific tissues. Challenges include ensuring biocompatibility of implanted devices, scaling up tissue engineering for clinical use, improving the integration between biological systems and engineered devices, and navigating regulatory pathways that ensure safety while enabling innovation.',
  ]

  // Breadth-first bushy tree: ~3 children per parent, tracked locally because
  // the store's addNode returns a new object and never mutates our references.
  const CHILDREN_PER_PARENT = 3
  type Frontier = { node: TurnNode; depth: number; childCount: number }
  const frontier: Frontier[] = [{ node: root, depth: 0, childCount: root.childrenIds.length }]
  let created = 0

  while (created < 50 && frontier.length > 0) {
    const parent = frontier[0]
    const siblingIndex = parent.childCount
    const depth = parent.depth + 1

    const newId = crypto.randomUUID()
    // Spread on a grid: fan siblings out horizontally around the parent, step down per depth.
    const spreadX = (siblingIndex - (CHILDREN_PER_PARENT - 1) / 2) * 380
    const newNode: TurnNode = {
      id: newId,
      treeId: activeTreeId,
      parentId: parent.node.id,
      childrenIds: [],
      userPrompt: SEED_TEXT_PROMPTS[created % SEED_TEXT_PROMPTS.length]!,
      assistantResponse: SEED_TEXT_RESPONSES[created % SEED_TEXT_RESPONSES.length]!,
      positionX: Math.round(parent.node.positionX + spreadX + depth * 40),
      positionY: Math.round(root.positionY + depth * 300),
      isCollapsed: false,
      status: 'idle',
      modelUsed: settings.defaultModel,
      timestamp: Date.now(),
      provider: settings.provider,
    }

    // eslint-disable-next-line no-await-in-loop
    await addNode(newNode)
    frontier.push({ node: newNode, depth, childCount: 0 })
    parent.childCount += 1
    created += 1
    if (parent.childCount >= CHILDREN_PER_PARENT) frontier.shift()
  }

  const nodeCount = created
  console.log(`[seedFiftyNodes] Created ${nodeCount} nodes`)
}

// DEV-ONLY: install window helpers
export function installRenderHarness() {
  if (!import.meta.env.DEV || typeof window === 'undefined') return

  window.__hydraRenderTally = {
    enable: enableRenderTally,
    disable: disableRenderTally,
    reset: resetRenderTally,
    get: getRenderTally,
  }

  window.__hydraSeedFiftyNodes = seedFiftyNodes
}

// TypeScript global augmentation
declare global {
  interface Window {
    __hydraRenderTallyOn?: boolean
    __hydraRenderTally?: {
      enable: () => void
      disable: () => void
      reset: () => void
      get: () => Record<string, number>
    }
    __hydraSeedFiftyNodes?: (
    ) => Promise<void>
  }
}
