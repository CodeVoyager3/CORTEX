from config.database import db

print("🧹 Wiping databases clean...")

# 1. Clear MongoDB
collection = db.mongo["engineering_hub"]["code_chunks"]
deleted_mongo = collection.delete_many({})
print(f"✅ Deleted {deleted_mongo.deleted_count} documents from MongoDB.")

# 2. Clear Neo4j
with db.neo4j.session() as session:
    # This Cypher query deletes ALL nodes and ALL relationships
    session.run("MATCH (n) DETACH DELETE n")
print("✅ Deleted all nodes and relationships from Neo4j.")

print("✨ Environment reset complete! Ready for fresh ingestion.")