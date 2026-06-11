import os
import json
import time

# Look how clean these imports are now!
from config.database import db
from core.ast_parser import ast_parser
from core.embedding import embedding_service

# Added '.venv' and 'env' to cover all standard Python environment names
IGNORE_DIRS = {'node_modules', 'venv', '.venv', 'env','.env', '.git', '__pycache__', 'dist', 'build', '.next'}

SYSTEM_PROMPT = """
You are an expert Data Engineer. Extract functional entities (nodes) and structural relationships (edges) from this code.
Respond ONLY with valid JSON.
Allowed Node Types: Function, Class, Variable. 
Allowed Edge Types: CALLS, DEFINES, IMPORTS.
Output Schema: {"nodes": [{"id": "name", "type": "Type", "description": "desc"}], "edges": [{"source": "id1", "target": "id2", "type": "Type"}]}
"""

class IngestionService:
    """
    Crawls a local repository, utilizes the AST Parser to extract chunks,
    queries Groq for relationships, and pushes data to Neo4j and MongoDB.
    """
    def __init__(self):
        print("🚀 Initializing Ingestion Service...")

    def process_chunk(self, file_path: str, chunk_text: str, chunk_type: str):
        print(f"   ⚙️ Processing {chunk_type} from {os.path.basename(file_path)}...")
        
        # 1. Ask Groq for the Graph JSON (Using our centralized DB manager)
        try:
            response = db.groq.chat.completions.create(
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": f"Extract relationships:\n\n{chunk_text}"}
                ],
                model="llama-3.3-70b-versatile",
                response_format={"type": "json_object"},
                temperature=0.1
            )
            graph_data = json.loads(response.choices[0].message.content)
        except Exception as e:
            print(f"   ⚠️ LLM Extraction failed: {e}")
            return


        file_name = os.path.basename(file_path)

        # Prefix every Node ID with the filename
        for node in graph_data.get("nodes", []):
            node["id"] = f"{file_name}::{node['id']}"
        
        # Prefix every Edge Source and Target to match the new Node IDs
        for edge in graph_data.get("edges", []):
            edge["source"] = f"{file_name}::{edge['source']}"
            edge["target"] = f"{file_name}::{edge['target']}"
        # ==========================================
        
        # 2. Push to Neo4j
        with db.neo4j.session() as session:
            for node in graph_data.get("nodes", []):
                cypher_node = f"MERGE (n:{node['type']} {{id: $id}}) ON CREATE SET n.description = $description"
                session.run(cypher_node, id=node["id"], description=node["description"])
            
            for edge in graph_data.get("edges", []):
                cypher_edge = f"MATCH (s {{id: $source_id}}), (t {{id: $target_id}}) MERGE (s)-[r:{edge['type']}]->(t)"
                session.run(cypher_edge, source_id=edge["source"], target_id=edge["target"])
                
        # 3. Generate Embeddings & Push to MongoDB
        vector = embedding_service.generate_vector(chunk_text)
        primary_entity = graph_data["nodes"][0]["id"] if graph_data.get("nodes") else "unknown"
        
        collection = db.mongo["engineering_hub"]["code_chunks"]
        collection.insert_one({
            "text": chunk_text,
            "metadata": {"file_path": file_path, "type": chunk_type, "entity_id": primary_entity},
            "embedding": vector
        })

    def ingest_directory(self, directory_path: str):
        print(f"\n📂 Starting Multi-Language Ingestion on: {directory_path}")
        
        for root, dirs, files in os.walk(directory_path):
            # Skip ignored directories
            dirs[:] = [d for d in dirs if d not in IGNORE_DIRS]
            
            for file in files:
                file_path = os.path.join(root, file)
                
                # The core parser automatically handles extension checking and skipping!
                extracted_chunks = ast_parser.parse_file(file_path)
                
                if extracted_chunks:
                    print(f"\n📄 Reading {file_path} ({len(extracted_chunks)} chunks found)")
                    for chunk in extracted_chunks:
                        self.process_chunk(file_path, chunk["text"], chunk["type"])
                        time.sleep(1.5)  # Rate limiting for API safety

# Export singleton
ingestion_service = IngestionService()