// DebugResults.jsx - Add this temporarily to debug the results issue
import React from 'react';
import useAppStore from '../stores/appStore';

const DebugResults = () => {
  const results = useAppStore((state) => state.results);
  const currentSessionId = useAppStore((state) => state.currentSessionId);
  const processingStatus = useAppStore((state) => state.processingStatus);

  return (
    <div style={{ 
      position: 'fixed', 
      top: '10px', 
      right: '10px', 
      background: 'black', 
      color: 'white', 
      padding: '10px', 
      borderRadius: '5px', 
      fontSize: '12px', 
      zIndex: 9999,
      maxWidth: '300px',
      maxHeight: '400px',
      overflow: 'auto'
    }}>
      <h4>DEBUG INFO</h4>
      <p><strong>Session ID:</strong> {currentSessionId || 'null'}</p>
      <p><strong>Status:</strong> {processingStatus?.status || 'null'}</p>
      <p><strong>Progress:</strong> {processingStatus?.progress || 'null'}</p>
      <p><strong>Results:</strong> {results ? 'EXISTS' : 'NULL'}</p>
      
      {results && (
        <div>
          <p><strong>Results Type:</strong> {typeof results}</p>
          <p><strong>Results Keys:</strong> {Object.keys(results).join(', ')}</p>
          
          {results.results && (
            <div>
              <p><strong>Results.results Keys:</strong> {Object.keys(results.results).join(', ')}</p>
              
              {results.results.segments && (
                <p><strong>Segments Count:</strong> {results.results.segments.length}</p>
              )}
              
              {results.results.metadata && (
                <div>
                  <p><strong>Duration:</strong> {results.results.metadata.duration}s</p>
                  <p><strong>Language:</strong> {results.results.metadata.language}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
      
      <details style={{ marginTop: '10px' }}>
        <summary>Raw Results Data</summary>
        <pre style={{ fontSize: '10px', maxHeight: '200px', overflow: 'auto' }}>
          {JSON.stringify(results, null, 2)}
        </pre>
      </details>
    </div>
  );
};

export default DebugResults;