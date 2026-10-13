/**
 * The one default brief a report starts from. The user edits it per report;
 * there is no template library. It asks the model to name disagreements, never
 * to resolve them silently, and to stay inside the transcript.
 */
export const DEFAULT_BRIEF = `You are writing a report from a branching conversation. Several branches explored the same question in different directions.

Write one cohesive document for a reader who did not see the conversation.
- Build one line of argument from start to finish. Do not summarize branch by branch.
- Where branches disagree, say so plainly and give both positions. If one is clearly better supported, say which and why.
- Use only what is in the transcript. Do not invent facts, numbers or sources.
- Cite the turns a point comes from by their tags, like [t3] or [t2, t5].
- Open with a # title. Use ## sections. Keep it as short as the material allows.`

/** First `#` heading of the output, else "Report". */
export function reportTitle(text: string): string {
  const match = /^#\s+(.+)$/m.exec(text)
  return match ? match[1].trim() : 'Report'
}
