const FormattedTextPanel = ({ results, structures, isExpanded, onToggleExpand, hasSession }) => {
    const [selectedSection, setSelectedSection] = useState('introduction');
    const [copied, setCopied] = useState(false);
  
    const handleCopy = async () => {
      try {
        const content = results ? (results?.summary || results?.analysis || 'Processing in progress...') : getDummyContent();
        await navigator.clipboard.writeText(content);
        setCopied(true);
        toast.success('Copied to clipboard!');
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        toast.error('Failed to copy text');
      }
    };
  
    const getDummyContent = () => {
      const dummyContents = {
        introduction: `**Introduction**
  
  This section contains the opening remarks and context-setting information from the conversation. The participant introduced themselves and provided initial background about the purpose of this session.
  
  Key points covered:
  • Session objectives and expectations
  • Participant background overview
  • Initial rapport building
  • Context establishment
  
  The conversation began with standard introductory protocols and moved into more substantive discussion areas.`,
  
        biographic: `**Biographical History**
  
  This section captures personal background information and life history details shared during the conversation.
  
  **Early Life**
  • Birth and family background
  • Childhood experiences and formative years
  • Educational journey and milestones
  
  **Career Development**
  • Professional path and key transitions
  • Notable achievements and challenges
  • Current role and responsibilities
  
  **Personal Milestones**
  • Significant life events
  • Relationships and family formation
  • Geographic movements and relocations`,
  
        professional: `**Professional Background**
  
  Detailed information about the participant's career trajectory and professional experiences.
  
  **Current Position**
  • Role and responsibilities
  • Organization and industry context
  • Team and reporting structure
  
  **Career Progression**
  • Previous positions and transitions
  • Skills development and expertise
  • Professional achievements and recognition
  
  **Work Philosophy**
  • Approach to challenges
  • Leadership style and principles
  • Future career aspirations`,
  
        social: `**Social History**
  
  Information about social connections, community involvement, and interpersonal relationships.
  
  **Social Networks**
  • Family relationships and dynamics
  • Friend circles and social connections
  • Community involvement and activities
  
  **Cultural Background**
  • Cultural identity and heritage
  • Language preferences and abilities
  • Traditional practices and values
  
  **Social Activities**
  • Hobbies and recreational interests
  • Volunteer work and community service
  • Social groups and memberships`,
  
        family: `**Family History**
  
  Comprehensive family background and relationship information.
  
  **Immediate Family**
  • Spouse/partner and relationship details
  • Children and their current status
  • Living arrangements and household composition
  
  **Extended Family**
  • Parents and siblings
  • Extended family relationships
  • Family traditions and connections
  
  **Family Health History**
  • Genetic predispositions
  • Family medical conditions
  • Health patterns and concerns`,
  
        medical: `**Medical History**
  
  Health-related information and medical background details.
  
  **Current Health Status**
  • Present health conditions
  • Current medications and treatments
  • Recent medical consultations
  
  **Medical History**
  • Past illnesses and conditions
  • Surgical procedures and hospitalizations
  • Chronic conditions and management
  
  **Health Maintenance**
  • Preventive care practices
  • Regular check-ups and screenings
  • Health and wellness routines`,
  
        educational: `**Educational History**
  
  Academic background and learning experiences.
  
  **Formal Education**
  • Primary and secondary education
  • Higher education and degrees
  • Specialized training and certifications
  
  **Continuing Education**
  • Professional development courses
  • Skills training and workshops
  • Self-directed learning initiatives
  
  **Academic Achievements**
  • Notable accomplishments
  • Research and publications
  • Academic honors and recognition`
      };
  
      return dummyContents[selectedSection] || dummyContents.introduction;
    };
  
    const formatContent = (text) => {
      if (!text) return hasSession ? 'Processing complete. Formatted text based on selected structures will appear here.' : getDummyContent();
      
      return text.split('\n').map((line, index) => {
        if (line.startsWith('**') && line.endsWith('**')) {
          return (
            <h4 key={index} className="text-lg font-semibold text-gray-900 mt-4 mb-2">
              {line.replace(/\*\*/g, '')}
            </h4>
          );
        }
        if (line.startsWith('###')) {
          return (
            <h5 key={index} className="text-md font-medium text-gray-800 mt-3 mb-2">
              {line.replace(/###/g, '')}
            </h5>
          );
        }
        if (line.startsWith('- ') || line.startsWith('• ')) {
          return (
            <li key={index} className="ml-4 text-gray-700 mb-1 list-disc">
              {line.replace(/^[•\-]\s/, '')}
            </li>
          );
        }
        if (line.includes('**')) {
          return (
            <p key={index} className="text-gray-700 mb-2" dangerouslySetInnerHTML={{
              __html: line.replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-gray-900">$1</strong>')
            }} />
          );
        }
        if (line.trim()) {
          return <p key={index} className="text-gray-700 mb-2 leading-relaxed">{line}</p>;
        }
        return <br key={index} />;
      });
    };
  
    // Generate sections based on selected structures or show defaults
    const sections = structures && structures.length > 0 ? [
      { id: 'introduction', name: 'Introduction', enabled: structures?.includes('Introduction') },
      { id: 'biographic', name: 'Biographic History', enabled: structures?.includes('Biographical History') },
      { id: 'professional', name: 'Professional Background', enabled: structures?.includes('Professional Background') },
      { id: 'social', name: 'Social History', enabled: structures?.includes('Social History') },
      { id: 'family', name: 'Family History', enabled: structures?.includes('Family History') },
      { id: 'medical', name: 'Medical History', enabled: structures?.includes('Medical History') },
      { id: 'educational', name: 'Educational History', enabled: true }
    ].filter(section => section.enabled) : [
      { id: 'introduction', name: 'Introduction', enabled: true },
      { id: 'biographic', name: 'Biographic History', enabled: true },
      { id: 'professional', name: 'Professional Background', enabled: true },
      { id: 'social', name: 'Social History', enabled: true },
      { id: 'family', name: 'Family History', enabled: true },
      { id: 'medical', name: 'Medical History', enabled: true },
      { id: 'educational', name: 'Educational History', enabled: true }
    ];
  
    return (
      <div className="bg-gray-100 rounded-2xl p-6 h-full">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Formatted Text</h2>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleCopy}
              className="p-2 bg-gray-200 hover:bg-gray-300 rounded-lg transition-colors"
              title="Copy to clipboard"
            >
              {copied ? (
                <CheckCircle className="w-4 h-4 text-green-600" />
              ) : (
                <Copy className="w-4 h-4 text-gray-600" />
              )}
            </button>
            <button
              onClick={onToggleExpand}
              className="p-2 bg-gray-200 hover:bg-gray-300 rounded-lg transition-colors"
              title={isExpanded ? "Minimize" : "Maximize"}
            >
              {isExpanded ? (
                <Minimize2 className="w-4 h-4 text-gray-600" />
              ) : (
                <Maximize2 className="w-4 h-4 text-gray-600" />
              )}
            </button>
          </div>
        </div>
        
        <div className="space-y-4">
          {sections.map((section, index) => (
            <div 
              key={section.id}
              className={`p-4 rounded-xl cursor-pointer transition-colors ${
                selectedSection === section.id 
                  ? index % 2 === 0 ? 'bg-gray-400' : 'bg-gray-300'
                  : index % 2 === 0 ? 'bg-gray-300 hover:bg-gray-350' : 'bg-gray-200 hover:bg-gray-250'
              }`}
              onClick={() => setSelectedSection(section.id)}
            >
              <h3 className={`text-lg font-semibold mb-2 ${
                selectedSection === section.id && index % 2 === 0 ? 'text-gray-100' : 'text-gray-700'
              }`}>
                {section.name}
              </h3>
              <div className={`rounded-lg flex items-start justify-start p-4 ${
                selectedSection === section.id && index % 2 === 0 ? 'bg-gray-600' : 'bg-gray-300'
              } ${isExpanded ? 'min-h-32' : 'h-24'} overflow-y-auto`}>
                <div className={`prose prose-sm max-w-none ${
                  selectedSection === section.id && index % 2 === 0 ? 'text-gray-200' : 'text-gray-600'
                }`}>
                  {selectedSection === section.id ? (
                    hasSession && results ? formatContent(results?.summary || results?.analysis) : (
                      hasSession ? (
                        <div className="flex items-center space-x-2">
                          <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                          <span>Processing transcription...</span>
                        </div>
                      ) : (
                        <div className="text-sm">{formatContent(getDummyContent())}</div>
                      )
                    )
                  ) : (
                    <span>{section.name} content area</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };