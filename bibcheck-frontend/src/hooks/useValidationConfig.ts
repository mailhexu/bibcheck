import { useState, useCallback } from 'react';

export interface ValidationConfig {
  author: boolean;
  title: boolean;
  journal: boolean;
  year: boolean;
  volume: boolean;
  number: boolean;
  pages: boolean;
  doi: boolean;
  autoAcceptChanges: boolean;
}

export interface ValidationConfigHook {
  config: ValidationConfig;
  loaded: boolean;
  updateConfig: (field: keyof ValidationConfig, value: boolean) => void;
  resetConfig: () => void;
  getEnabledFields: () => (keyof ValidationConfig)[];
}

const defaultConfig: ValidationConfig = {
  author: false,  // Disabled by default
  title: false,   // Disabled by default
  journal: true,
  year: true,
  volume: true,
  number: true,
  pages: true,
  doi: true,
  autoAcceptChanges: true // Default to true for auto-accept
};

export function useValidationConfig(): ValidationConfigHook {
  const [config, setConfig] = useState<ValidationConfig>({ ...defaultConfig });
  const [loaded, setLoaded] = useState(false);

  // Update a single field in the config
  const updateConfig = useCallback((field: keyof ValidationConfig, value: boolean) => {
    console.log('🔧 Updating validation config:', field, value);
    setConfig(prev => ({
      ...prev,
      [field]: value
    }));
    setLoaded(true);
  }, []);

  // Reset config to defaults
  const resetConfig = useCallback(() => {
    console.log('🔄 Resetting validation config to defaults');
    setConfig({ ...defaultConfig });
    setLoaded(true);
  }, []);

  // Get list of enabled field names
  const getEnabledFields = useCallback(() => {
    const enabledFields = (Object.entries(config) as [keyof ValidationConfig, boolean][])
      .filter(([key, value]) => value && key !== 'autoAcceptChanges') // Exclude autoAcceptChanges from field list
      .map(([key]) => key);
    console.log('📋 Enabled validation fields:', enabledFields);
    return enabledFields;
  }, [config]);

  if (!loaded) {
    setLoaded(true);
  }

  return {
    config,
    loaded,
    updateConfig,
    resetConfig,
    getEnabledFields
  };
}
