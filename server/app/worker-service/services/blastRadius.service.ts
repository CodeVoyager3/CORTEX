import { prisma } from '../../../package/db/prisma';
import { buildTargetKeys, resolveImportSpecifier } from '../../../package/ast/imports';

export interface ImpactedChunk {
  id: string;
  filePath: string;
  symbolName: string;
  nodeType: string;
  reason: 'direct_import' | 'direct_call' | 'transitive';
}

export class BlastRadiusService {
  /**
   * Calculates all downstream code chunks impacted by changes in a PR.
   *
   * @param repositoryId Prisma Repository ID
   * @param modifiedFiles Array of file paths changed in the PR (e.g. ['src/utils/auth.ts'])
   * @param modifiedSymbols Array of symbol names modified (e.g. ['validateToken'])
   */
  public async calculateBlastRadius(
    repositoryId: string,
    modifiedFiles: string[],
    modifiedSymbols: string[]
  ): Promise<ImpactedChunk[]> {
    if (modifiedFiles.length === 0 && modifiedSymbols.length === 0) {
      return [];
    }

    const impactedMap = new Map<string, ImpactedChunk>();
    const targetKeys = buildTargetKeys(modifiedFiles);

    // Import edges must be resolved per importing file (path-relative), which the
    // DB cannot do, so pull chunks that carry either imports or a matching call edge
    // and resolve in memory.
    const candidates = await prisma.codeChunk.findMany({
      where: {
        repositoryId,
        OR: [
          ...(modifiedFiles.length > 0 ? [{ imports: { isEmpty: false } }] : []),
          ...(modifiedSymbols.length > 0 ? [{ calledBy: { hasSome: modifiedSymbols } }] : []),
        ],
      },
      select: {
        id: true,
        filePath: true,
        symbolName: true,
        nodeType: true,
        imports: true,
        calledBy: true,
      },
    });

    const directImpactedSymbols: string[] = [];

    for (const chunk of candidates) {
      let reason: ImpactedChunk['reason'] | null = null;

      if (modifiedFiles.length > 0) {
        for (const imp of chunk.imports) {
          const resolved = resolveImportSpecifier(imp, chunk.filePath);
          if (resolved && targetKeys.has(resolved)) {
            reason = 'direct_import';
            break;
          }
        }
      }

      // calledBy holds the symbols this chunk invokes (outgoing call edges), so a
      // match means this chunk depends on a modified symbol.
      if (!reason && modifiedSymbols.length > 0 && chunk.calledBy.some((c) => modifiedSymbols.includes(c))) {
        reason = 'direct_call';
      }

      if (!reason) continue;

      impactedMap.set(chunk.id, {
        id: chunk.id,
        filePath: chunk.filePath,
        symbolName: chunk.symbolName,
        nodeType: chunk.nodeType,
        reason,
      });

      directImpactedSymbols.push(chunk.symbolName);
    }

    // Step 2: Query Transitive (2nd-Order) Dependents if direct dependents exist
    if (directImpactedSymbols.length > 0) {
      const transitiveDependents = await prisma.codeChunk.findMany({
        where: {
          repositoryId,
          calledBy: { hasSome: directImpactedSymbols },
          id: { notIn: Array.from(impactedMap.keys()) },
        },
        select: {
          id: true,
          filePath: true,
          symbolName: true,
          nodeType: true,
        },
      });

      for (const chunk of transitiveDependents) {
        impactedMap.set(chunk.id, {
          id: chunk.id,
          filePath: chunk.filePath,
          symbolName: chunk.symbolName,
          nodeType: chunk.nodeType,
          reason: 'transitive',
        });
      }
    }

    return Array.from(impactedMap.values());
  }
}

export const blastRadiusService = new BlastRadiusService();
