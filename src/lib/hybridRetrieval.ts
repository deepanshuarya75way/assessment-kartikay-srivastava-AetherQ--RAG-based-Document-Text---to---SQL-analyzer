export function generateSparseRepresentation(text: string): Record<string, number> {
  const tokens = text.toLowerCase().match(/\w+/g) || []
  const freq: Record<string, number> = {}
  tokens.forEach(t => {
    if(t.length > 2) freq[t] = (freq[t] || 0) +1
  })
  Object.keys(freq).forEach(k => {
    freq[k] = Math.log(1 + freq[k])
  })
  return freq

}

export function calculateBM25Score(queryTokens: string[], docFreq: Record<string, number>): number {
  let score = 0
  queryTokens.forEach(token => {
    if (docFreq[token]) score += docFreq[token]
  })
  return score
}
export async function hybridSearch(
  supabase: any,
  query: string,
  queryEmbedding: number[],
  options = { denseLimit: 10,sparseLimit: 10, finalLimit: 10 }
) {
  const { data: denseResults } = await supabase.rpc('match_documents' , {
    query_embedding: queryEmbedding,
    match_threshold: 0.3,
    match_count: options.denseLimit
  }) 

  const { data: sparseResults } = await supabase
  .from('documents')
  .select('id, content, metadata, page_number, source')
  .textSearch('content' , query, {type: 'websearch' , config: 'english' })
  .limit(options.sparseLimit)

  let finalSparse = sparseResults
  if (!sparseResults || sparseResults.length === 0) {
    const firstWord = query.split( ' ').find(w => w.length > 2) || query
    const { data: keywordResults} = await supabase
     .from('documents')
     .select('id, content, metadata, page_number, source')
     .ilike('content' , '%${firstWord}%')
     .limit(options.sparseLimit)
    finalSparse = keywordResults
  }

  const docMap = new Map()
  const k = 60

  denseResults?.forEach((doc: any,idx:number) => {
    const score = 1 / (k + idx + 1)
    docMap.set(doc.id, {
      ...doc,
      hybrid_score: score,
      'retrieval_source: 'dense',
      dense_rank: idx,
      sparse_rank: 999
    })
  })

  finalSparse?.forEach((doc: any, idx: number))
const score = 1 / (k + id≈ + 1)
if (docMap.has(doc.id)) {
  const existing = docMap.get(doc.id)
  existing.hybrid_score += score
  existing.retrieval_source = 'both'
  existing.sparse_rank = idx
} else {
  docMap.set(doc.id, {
    ...doc,
    hybrid_score: score
    retrieval_source: 'sparse' ,
    dense_rank: 999,
    sparse_rank: idx
  })
}
})

const ranked = Array.from(docMap.values())
.sort((a,b) => b.hybrid_score - a.hybrid_score)
.slice(0, options.finalLimit)
.map(doc => ({
  ...doc,
  citation: doc.metadata?.source || doc.source,
  page: doc.page_number || doc.metadata?.page
}))

return ranked
}

export async function retrieveWithHybrid(supabase: any, query: string, embedding: number[]) {
  const sparseEmbedding = generateSparseRepesentation(query)
  const results = await hybridSearch(supbase, query, embedding)
  return { results, sparseEmbedding }
}