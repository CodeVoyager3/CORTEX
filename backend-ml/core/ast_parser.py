import os
from tree_sitter import Language, Parser, Query, QueryCursor

# Import the language grammars
import tree_sitter_javascript as tsjavascript
import tree_sitter_python as tspython
import tree_sitter_cpp as tscpp

class CodeASTParser:
    """
    A multi-language Abstract Syntax Tree (AST) parser.
    Loads grammars into memory once and dynamically routes files 
    based on their extensions to extract logical chunks.
    """
    def __init__(self):
        print("🌳 Booting up Multi-Language AST Parser...")
        
        # Load grammars once during instantiation
        self.js_lang = Language(tsjavascript.language())
        self.py_lang = Language(tspython.language())
        self.cpp_lang = Language(tscpp.language())

        # Map extensions to their specific language parser and extraction queries
        self.language_config = {
            ".js": {
                "language": self.js_lang,
                "query": "(function_declaration) @function (method_definition) @method"
            },
            ".jsx": {
                "language": self.js_lang,
                "query": "(function_declaration) @function (arrow_function) @function (method_definition) @method"
            },
            ".py": {
                "language": self.py_lang,
                "query": "(function_definition) @function (class_definition) @class"
            },
            ".cpp": {
                "language": self.cpp_lang,
                "query": "(function_definition) @function (class_specifier) @class"
            }
        }

    def parse_file(self, file_path):
        """
        Reads a file, parses its AST, and returns a list of dictionaries 
        containing the raw code text and its structural type.
        """
        _, ext = os.path.splitext(file_path)
        
        # If the language isn't supported, skip it safely
        if ext not in self.language_config:
            return []

        config = self.language_config[ext]
        
        # Initialize parser for this specific language
        parser = Parser(config["language"])
        query = Query(config["language"], config["query"])

        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                code_content = f.read()
            
            # Parse into a syntax tree
            tree = parser.parse(bytes(code_content, "utf8"))
            cursor = QueryCursor(query)
            captures_dict = cursor.captures(tree.root_node)
            
            extracted_chunks = []
            
            # Unpack the captures into a clean Python list of dictionaries
            for chunk_type, nodes in captures_dict.items():
                for node in nodes:
                    chunk_text = node.text.decode('utf8')
                    extracted_chunks.append({
                        "type": chunk_type,
                        "text": chunk_text
                    })
                    
            return extracted_chunks

        except Exception as e:
            print(f"⚠️ AST Error parsing {file_path}: {e}")
            return []

# Export a single instance to be imported elsewhere
ast_parser = CodeASTParser()