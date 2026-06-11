# config/database.py
import os
from dotenv import load_dotenv
from pymongo import MongoClient
from neo4j import GraphDatabase
from groq import Groq

# Load environment variables from the .env file
load_dotenv()

# Fetch credentials securely
MONGO_URI = os.getenv("MONGO_URI")
NEO4J_URI = os.getenv("NEO4J_URI")
NEO4J_USER = os.getenv("NEO4J_USER")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

class DatabaseManager:
    """
    Centralized manager for all external database and API connections.
    Uses the Singleton pattern to prevent opening duplicate connections.
    """
    def __init__(self):
        self._mongo_client = None
        self._neo4j_driver = None
        self._groq_client = None

    @property
    def mongo(self):
        if not self._mongo_client:
            print("🔌 Initializing MongoDB connection...")
            self._mongo_client = MongoClient(MONGO_URI)
        return self._mongo_client

    @property
    def neo4j(self):
        if not self._neo4j_driver:
            print("🔌 Initializing Neo4j connection...")
            self._neo4j_driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))
        return self._neo4j_driver

    @property
    def groq(self):
        if not self._groq_client:
            print("🔌 Initializing Groq client...")
            self._groq_client = Groq(api_key=GROQ_API_KEY)
        return self._groq_client

    def close_all(self):
        if self._mongo_client:
            self._mongo_client.close()
        if self._neo4j_driver:
            self._neo4j_driver.close()

# Exporting a single instance to be used across the app
db = DatabaseManager()