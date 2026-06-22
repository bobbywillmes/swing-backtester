import {
  getKnownSecurity,
  SecurityAssetType,
} from "../data/security-catalog.js";

export interface SecurityMetadataRecord {
  symbol: string;
  name: string;
  assetType: SecurityAssetType;
}

export interface RunScopeRecord {
  symbol: string;
  securityAssetType: SecurityAssetType;
  scenarioName: string;
  scenarioAssetTypeScope: SecurityAssetType | null;
}

export interface SymbolCount {
  symbol: string;
  count: number;
}

export interface ScopeConflict {
  symbol: string;
  securityAssetType: SecurityAssetType;
  scenarioName: string;
  scenarioAssetTypeScope: SecurityAssetType;
  count: number;
}

export interface SecurityMetadataConflict {
  symbol: string;
  storedName: string;
  catalogName: string;
  storedAssetType: SecurityAssetType;
  catalogAssetType: SecurityAssetType;
}

export interface SecurityIntegrityReport {
  unknownStoredSymbols: string[];
  unknownTradeSymbols: SymbolCount[];
  metadataConflicts: SecurityMetadataConflict[];
  scopeConflicts: ScopeConflict[];
  hasConflicts: boolean;
}

export function validateSecurityIntegrity(input: {
  securities: SecurityMetadataRecord[];
  actualTradeSymbols: SymbolCount[];
  runScopeRecords: RunScopeRecord[];
}): SecurityIntegrityReport {
  const unknownStoredSymbols = input.securities
    .filter((security) => !getKnownSecurity(security.symbol))
    .map((security) => security.symbol)
    .sort();

  const unknownTradeSymbols = input.actualTradeSymbols
    .filter((symbolCount) => !getKnownSecurity(symbolCount.symbol))
    .sort((a, b) => a.symbol.localeCompare(b.symbol));

  const metadataConflicts = input.securities
    .map((security) => {
      const catalog = getKnownSecurity(security.symbol);

      if (!catalog) {
        return null;
      }

      if (
        catalog.name === security.name &&
        catalog.assetType === security.assetType
      ) {
        return null;
      }

      return {
        symbol: security.symbol,
        storedName: security.name,
        catalogName: catalog.name,
        storedAssetType: security.assetType,
        catalogAssetType: catalog.assetType,
      };
    })
    .filter((conflict): conflict is SecurityMetadataConflict => conflict !== null)
    .sort((a, b) => a.symbol.localeCompare(b.symbol));

  const scopeConflictMap = new Map<string, ScopeConflict>();

  for (const record of input.runScopeRecords) {
    if (
      record.scenarioAssetTypeScope === null ||
      record.scenarioAssetTypeScope === record.securityAssetType
    ) {
      continue;
    }

    const key = [
      record.symbol,
      record.securityAssetType,
      record.scenarioName,
      record.scenarioAssetTypeScope,
    ].join("|");
    const existing = scopeConflictMap.get(key);

    if (existing) {
      existing.count += 1;
    } else {
      scopeConflictMap.set(key, {
        symbol: record.symbol,
        securityAssetType: record.securityAssetType,
        scenarioName: record.scenarioName,
        scenarioAssetTypeScope: record.scenarioAssetTypeScope,
        count: 1,
      });
    }
  }

  const scopeConflicts = [...scopeConflictMap.values()].sort((a, b) =>
    a.symbol.localeCompare(b.symbol) ||
    a.scenarioName.localeCompare(b.scenarioName)
  );

  return {
    unknownStoredSymbols,
    unknownTradeSymbols,
    metadataConflicts,
    scopeConflicts,
    hasConflicts:
      unknownStoredSymbols.length > 0 ||
      unknownTradeSymbols.length > 0 ||
      metadataConflicts.length > 0 ||
      scopeConflicts.length > 0,
  };
}
