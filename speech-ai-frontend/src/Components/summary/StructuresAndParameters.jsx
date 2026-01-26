// src/components/StructuresAndParameters.jsx - Extracted Structures and Parameters Components
import React from 'react';
import { Loader2 } from 'lucide-react';

// Processing Structure Component - NO CHANGES from original
const ProcessingStructureSection = ({ structures, onStructureToggle, disabled }) => {
  return (
    <div className="bg-gray-100 p-6 rounded-lg">
      <h3 className="text-cyan-400 text-lg font-semibold mb-4">Structures</h3>
      <p className="text-gray-600 mb-4">Specify the Order in which Conversation should be Processed</p>
      
      <div className="space-y-3">
        {structures.map((structure, index) => (
          <div key={index} className="flex items-center justify-between">
            <span className="text-gray-700">
              {index + 1}. {structure.name}
            </span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={structure.enabled}
                onChange={() => onStructureToggle(index)}
                disabled={disabled}
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-cyan-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-400 disabled:opacity-50"></div>
            </label>
          </div>
        ))}
      </div>
    </div>
  );
};

// Processing Parameters Component - NO CHANGES from original
const ProcessingParametersSection = ({ parameters, onParameterToggle, onStartProcessing, canProcess, isProcessing }) => {
  return (
    <div className="bg-gray-100 p-6 rounded-lg">
      <h3 className="text-cyan-400 text-lg font-semibold mb-4">Parameters</h3>
      <p className="text-gray-600 mb-4">Specify the Order in which Conversation should be Processed</p>
      
      <div className="grid grid-cols-2 gap-3 mb-6">
        {parameters.map((param, index) => (
          <button
            key={index}
            onClick={() => onParameterToggle(index)}
            disabled={isProcessing}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
              param.enabled
                ? 'bg-cyan-400 text-white'
                : 'bg-gray-800 text-white hover:bg-gray-700'
            }`}
          >
            {param.name}
          </button>
        ))}
      </div>
      
      <button
        onClick={onStartProcessing}
        disabled={!canProcess || isProcessing}
        className={`w-full py-3 rounded-lg font-semibold transition-colors flex items-center justify-center space-x-2 ${
          canProcess && !isProcessing
            ? 'bg-cyan-400 text-white hover:bg-cyan-500'
            : 'bg-gray-400 text-gray-200 cursor-not-allowed'
        }`}
      >
        {isProcessing ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Processing...</span>
          </>
        ) : (
          <span>Start Processing File</span>
        )}
      </button>
    </div>
  );
};

// Combined Parent Component - EXPORTED
const StructuresAndParameters = ({ 
  structures, 
  onStructureToggle, 
  parameters, 
  onParameterToggle, 
  onStartProcessing, 
  canProcess, 
  isProcessing 
}) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left Column - Structures */}
      <ProcessingStructureSection 
        structures={structures}
        onStructureToggle={onStructureToggle}
        disabled={isProcessing}
      />
      
      {/* Right Column - Parameters */}
      <ProcessingParametersSection 
        parameters={parameters}
        onParameterToggle={onParameterToggle}
        onStartProcessing={onStartProcessing}
        canProcess={canProcess}
        isProcessing={isProcessing}
      />
    </div>
  );
};

// Export both individual components and combined component
export { ProcessingStructureSection, ProcessingParametersSection };
export default StructuresAndParameters;