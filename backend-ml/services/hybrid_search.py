from config.database import db
from core.embedding import embedding_service

class HybridSearchService:
    """
    Executes the multimodal GraphRAG retrieval pipeline.
    1. Vector Search (MongoDB) to find the relevant code chunk.
    2. Graph Traversal (Neo4j) to find structural dependencies.
    3. LLM Synthesis (Groq) to generate the final answer.
    """
    def __init__(self):
        print("🔍 Initializing Hybrid Search Service...")

    def execute_search(self, user_question: str) -> dict:
        print(f"\n👤 User Query: '{user_question}'")
        
        # --- 1. Vector Search (Find the Code) ---
        query_vector = embedding_service.generate_vector(user_question)
        collection = db.mongo["engineering_hub"]["code_chunks"]
        
        vector_results = list(collection.aggregate([
            {
                "$vectorSearch": {
                    "index": "vector_index",
                    "path": "embedding",
                    "queryVector": query_vector,
                    "numCandidates": 10,
                    "limit": 3
                }
            },
            {"$project": {"text": 1, "metadata": 1}}
        ]))

        if not vector_results:
            return {"answer": "I couldn't find any relevant code in the database to answer that.", "context": []}

        top_match = vector_results[0]
        target_entity = top_match["metadata"]["entity_id"]
        code_snippet = top_match["text"]
        print(f"✅ Vector Match: {target_entity}")

        # --- 2. Graph Traversal (Find the Blast Radius) ---
        graph_context = []
        with db.neo4j.session() as session:
            # Cypher query with the clean label extraction we fixed earlier
            cypher_query = """
            MATCH (n {id: $id})-[r]->(neighbor)
            RETURN type(r) AS relationship, neighbor.id AS neighbor_id, labels(neighbor)[0] AS neighbor_type
            """
            records = session.run(cypher_query, id=target_entity)
            for record in records:
                graph_context.append(f"- {target_entity} {record['relationship']} {record['neighbor_type']} '{record['neighbor_id']}'")

        print(f"✅ Graph Dependencies Found: {len(graph_context)}")

        # --- 3. LLM Synthesis ---
        compiled_context = f"""
        CODE SNIPPET FOUND:
        {code_snippet}

        STRUCTURAL DEPENDENCIES FOUND:
        {chr(10).join(graph_context)}
        """

        system_prompt = """
        You are an expert Senior Engineer answering questions about a codebase. 
        Use ONLY the provided Code Snippet and Structural Dependencies to answer the user's question. 
        Be concise, accurate, and mention the specific files or variables involved.
        """

        response = db.groq.chat.completions.create(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Context:\n{compiled_context}\n\nQuestion: {user_question}"}
            ],
            model="llama-3.3-70b-versatile",
            temperature=0.3
        )

        final_answer = response.choices[0].message.content
        
        # Return a clean dictionary so our upcoming API can send it as JSON
        return {
            "answer": final_answer,
            "target_entity": target_entity,
            "dependencies": graph_context
        }

# Export singleton
hybrid_search = HybridSearchService()