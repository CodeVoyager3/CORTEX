import Parser from 'tree-sitter';
import JavaScript from 'tree-sitter-javascript';
import TypeScript from 'tree-sitter-typescript';
import Python from 'tree-sitter-python';
import Cpp from 'tree-sitter-cpp';

// 1. Define the shape of the data your worker expects
export interface CodeChunk {
  type: string;
  name: string;
  content: string;
  startLine: number;
  endLine: number;
  imports: string[];
  calledBy: string[];
}

export class ASTParser {
  private parser: Parser;

  constructor() {
    console.log('Booting up Multi-Language AST Parser...');
    this.parser = new Parser();
  }

  /**
   * Parses a source file and extracts top-level functions, methods, and classes
   * as structured CodeChunk objects, complete with line numbers and imports.
   *
   * `calledBy` stores symbol names this chunk *calls* (outgoing edges). Blast-radius
   * queries find dependents via `calledBy: { hasSome: modifiedSymbols }`.
   */
  public parseFile(filePath: string, fileContent: string, extension: string): CodeChunk[] {
    const chunks: CodeChunk[] = [];

    // Step 1: Set the correct language based on the extension
    let language: any;
    let queryString = '';

    switch (extension) {
      case '.js':
      case '.jsx':
        language = JavaScript;
        queryString = `
          (function_declaration name: (identifier) @name) @function
          (method_definition name: (property_identifier) @name) @method
          (class_declaration name: (identifier) @name) @class
        `;
        break;
      case '.ts':
        language = TypeScript.typescript;
        queryString = `
          (function_declaration name: (identifier) @name) @function
          (method_definition name: (property_identifier) @name) @method
          (class_declaration name: (type_identifier) @name) @class
        `;
        break;
      case '.tsx':
        language = TypeScript.tsx;
        queryString = `
          (function_declaration name: (identifier) @name) @function
          (method_definition name: (property_identifier) @name) @method
          (class_declaration name: (type_identifier) @name) @class
        `;
        break;
      case '.py':
        language = Python;
        queryString = `
          (function_definition name: (identifier) @name) @function
          (class_definition name: (identifier) @name) @class
        `;
        break;
      case '.cpp':
      case '.cc':
      case '.cxx':
        language = Cpp;
        queryString = `
          (function_definition declarator: (function_declarator declarator: (identifier) @name)) @function
          (class_specifier name: (type_identifier) @name) @class
        `;
        break;
      default:
        console.warn(`Unsupported extension: ${extension}`);
        return [];
    }

    // Step 2: Parse the syntax tree
    this.parser.setLanguage(language);
    const tree = this.parser.parse(fileContent);

    // Step 3: Run the query against the AST
    const query = new Parser.Query(language, queryString);
    const matches = query.matches(tree.rootNode);

    // Step 4: Extract imports once for the whole file (blast radius context)
    const imports = this.extractImports(tree, language);

    // Step 5: Loop through matches and build CodeChunk objects
    for (const match of matches) {
      // Each match has an array of captures — we need two:
      //   • The "outer" capture (@function / @method / @class) → gives us the full node boundaries
      //   • The @name capture → gives us the symbol name
      let outerNode: Parser.SyntaxNode | null = null;
      let nameNode: Parser.SyntaxNode | null = null;
      let nodeType = '';

      for (const capture of match.captures) {
        if (['function', 'method', 'class'].includes(capture.name)) {
          outerNode = capture.node;
          nodeType = capture.name;   // 'function' | 'method' | 'class'
        } else if (capture.name === 'name') {
          nameNode = capture.node;
        }
      }

      // Skip malformed matches that are missing either piece
      if (!outerNode || !nameNode) continue;

      // Step 6: Pull line numbers from Tree-Sitter positions (0-indexed → convert to 1-indexed)
      const startLine = outerNode.startPosition.row + 1;
      const endLine   = outerNode.endPosition.row   + 1;

      // Step 7: Slice the raw source text for this node
      const content = fileContent.slice(outerNode.startIndex, outerNode.endIndex);

      // Step 8: Collect callee symbols from this node's subtree (blast-radius edges)
      const calledBy = this.extractCalls(outerNode, language, nameNode.text);

      chunks.push({
        type:      nodeType,
        name:      nameNode.text,
        content,
        startLine,
        endLine,
        imports,    // every chunk carries the file's import context
        calledBy,
      });
    }

    return chunks;
  }

  /**
   * Extracts callee symbol names from a chunk's AST subtree.
   * Stored in CodeChunk.calledBy so blast-radius can find "who calls X"
   * via chunks whose calledBy list contains X.
   */
  public extractCalls(
    node: Parser.SyntaxNode,
    language: any,
    selfName: string,
  ): string[] {
    let callQueryString = '';

    if (language === JavaScript || language === TypeScript.typescript || language === TypeScript.tsx) {
      callQueryString = `
        (call_expression function: (identifier) @callee)
        (call_expression
          function: (member_expression property: (property_identifier) @callee))
      `;
    } else if (language === Python) {
      callQueryString = `
        (call function: (identifier) @callee)
        (call function: (attribute attribute: (identifier) @callee))
      `;
    } else if (language === Cpp) {
      callQueryString = `
        (call_expression function: (identifier) @callee)
        (call_expression
          function: (field_expression field: (field_identifier) @callee))
      `;
    } else {
      return [];
    }

    const callees = new Set<string>();

    try {
      const callQuery = new Parser.Query(language, callQueryString);
      const callMatches = callQuery.matches(node);

      for (const match of callMatches) {
        for (const capture of match.captures) {
          if (capture.name !== 'callee') continue;
          const name = capture.node.text.trim();
          if (!name || name === selfName) continue;
          callees.add(name);
        }
      }
    } catch (err) {
      console.error('extractCalls query failed:', err);
    }

    return Array.from(callees);
  }

  /**
   * Extracts all import/require statements from the parsed tree.
   * This powers the "Blast Radius" feature — giving the LLM context
   * about every external file a module depends on.
   */
  public extractImports(tree: Parser.Tree, language: any): string[] {
    const importedModules: string[] = [];

    // Build a language-appropriate query for import statements
    let importQueryString = '';

    // Determine the language by checking known language objects
    if (language === JavaScript || language === TypeScript.typescript || language === TypeScript.tsx) {
      // JS / TS: covers:
      //   import foo from './foo'         → import_statement + source: string
      //   import { bar } from './bar'     → import_statement + source: string
      //   const x = require('./x')        → call_expression with callee "require"
      importQueryString = `
        (import_statement source: (string (string_fragment) @module))
        (call_expression
          function: (identifier) @require (#eq? @require "require")
          arguments: (arguments (string (string_fragment) @module)))
      `;
    } else if (language === Python) {
      // Python: covers:
      //   import os                       → import_statement, name: dotted_name
      //   from pathlib import Path        → import_from_statement, module_name: dotted_name
      importQueryString = `
        (import_statement name: (dotted_name) @module)
        (import_from_statement module_name: (dotted_name) @module)
        (import_from_statement module_name: (relative_import) @module)
      `;
    } else if (language === Cpp) {
      // C++: covers:
      //   #include <vector>               → preproc_include, path: system_lib_string
      //   #include "myfile.h"             → preproc_include, path: string_literal
      importQueryString = `
        (preproc_include path: (system_lib_string) @module)
        (preproc_include path: (string_literal) @module)
      `;
    } else {
      return [];
    }

    try {
      const importQuery = new Parser.Query(language, importQueryString);
      const importMatches = importQuery.matches(tree.rootNode);

      for (const match of importMatches) {
        for (const capture of match.captures) {
          // Skip the helper @require capture — only collect actual @module names
          if (capture.name === 'module') {
            const moduleText = capture.node.text.trim();
            if (moduleText && !importedModules.includes(moduleText)) {
              importedModules.push(moduleText);
            }
          }
        }
      }
    } catch (err) {
      console.error('extractImports query failed:', err);
    }

    return importedModules;
  }
}

export const astParser = new ASTParser();
