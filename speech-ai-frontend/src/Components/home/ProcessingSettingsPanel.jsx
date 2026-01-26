//UNUSED AT THE MOMENT

import React from 'react';
import AudioVisualizationSection from './AudioVisualizationSection';
import StructuresAndParameters from '../summary/StructuresAndParameters';

const ProcessingSettingsPanel = ({
  // Audio visualization props
  isProcessing,
  language,
  setLanguage,
  speakers,
  setSpeakers,
  handleStartProcessing,
  canProcess,
  // Structures and parameters props
  structures,
  onStructureToggle,
  parameters,
  onParameterToggle,
  showStructuresAndParameters = false
}) => {
  
  return (
    <div className="space-y-6">
      {/* Audio Visualization Section */}
      <AudioVisualizationSection
        isProcessing={isProcessing}
        language={language}
        setLanguage={setLanguage}
        speakers={speakers}
        setSpeakers={setSpeakers}
        handleStartProcessing={handleStartProcessing}
        canProcess={canProcess}
      />

      {/* Structures and Parameters Section - Optional */}
      {showStructuresAndParameters && (
        <StructuresAndParameters
          structures={structures}
          onStructureToggle={onStructureToggle}
          parameters={parameters}
          onParameterToggle={onParameterToggle}
          onStartProcessing={handleStartProcessing}
          canProcess={canProcess}
          isProcessing={isProcessing}
        />
      )}
    </div>
  );

};

export default ProcessingSettingsPanel;