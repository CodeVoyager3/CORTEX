from sentence_transformers import SentenceTransformer

class EmbeddingService:
    """
    Singleton service for generating text embeddings using SentenceTransformers.
    Loads the ML model into memory exactly once upon initialization.
    """
    def __init__(self):
        print("🧠 Booting up ML Embedding Model (all-MiniLM-L6-v2)...")
        # The model weights will be loaded from your local cache
        self.model = SentenceTransformer('all-MiniLM-L6-v2')

    def generate_vector(self, text: str) -> list[float]:
        """
        Takes a string of text and returns a 384-dimensional mathematical vector.
        Automatically converts the numpy array to a standard Python list for MongoDB.
        """
        if not text or not text.strip():
            return []
            
        try:
            vector = self.model.encode(text)
            return vector.tolist()
        except Exception as e:
            print(f"⚠️ Error generating embedding: {e}")
            return []

# Export a single initialized instance to be used across the app
embedding_service = EmbeddingService()